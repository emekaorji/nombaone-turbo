
import { buildSubscriptionLine, createInvoice, finalizeInvoice } from '../invoices';
import { loadSubscriptionRow } from '../subscriptions';
import { claimPeriod } from './claim';
import { collectForInvoice } from './collectForInvoice';
import {
  loadPriceById,
  loadPrimarySubscriptionItem,
  reconcilePaidSubEffects,
  resolveCollectionMethod,
} from './effects';
import { advancePeriod } from './period';
import { computeAnchor, periodBounds } from './scheduling';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '../context';
import type { InvoiceBillingReason } from '../invoices';
import type { CollectOutcome } from './types';

export interface RunCycleResult {
  invoice: InvoiceRow;
  outcome: CollectOutcome | 'open';
}

/**
 * Run ONE billing cycle for a subscription — the single orchestrator composed of
 * the primitives, and the exact unit 04's scheduler will call (no duplicated
 * billing logic). `createInvoice` → `finalizeInvoice` → `collectForInvoice`.
 * **Idempotent on `(subscription_id, period_index)`** (K2/J6): re-running returns
 * the existing invoice, never a second charge. A zero-amount invoice settles in
 * finalize with no rail call (J8); a `send_invoice`/method-less sub is left `open`
 * to await an inbound transfer.
 */
export async function runCycle(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionRef: string
): Promise<RunCycleResult> {
  const sub = await loadSubscriptionRow(txDb, ctx, subscriptionRef);
  const price = await loadPriceById(txDb, ctx, sub.priceId);
  const item = await loadPrimarySubscriptionItem(txDb, ctx, sub.id);

  // Period window for the index being billed — anchor-based precise math (04a):
  // boundaries are `anchor + n·interval` with EOM snap-back / leap handling.
  const anchor = sub.billingCycleAnchor ?? computeAnchor(sub.currentPeriodStart ?? new Date());
  const { start: periodStart, end: periodEnd } = periodBounds(
    anchor,
    { interval: price.interval, intervalCount: price.intervalCount },
    sub.currentPeriodIndex
  );
  const billingReason: InvoiceBillingReason =
    sub.currentPeriodIndex === 0 ? 'subscription_create' : 'subscription_cycle';

  const line = buildSubscriptionLine({
    description: `${price.reference} × ${item.quantity}`,
    unitAmount: item.unitAmount,
    quantity: item.quantity,
    subscriptionItemId: item.id,
    periodStart,
    periodEnd,
  });

  const invoice = await createInvoice(txDb, ctx, {
    customerId: sub.customerId,
    subscriptionId: sub.id,
    periodIndex: sub.currentPeriodIndex,
    billingReason,
    periodStart,
    periodEnd,
    lines: [line],
  });
  // Record the period claim (the 04 idempotency spine, B6/B8) linked to the
  // invoice — ON CONFLICT DO NOTHING, so a replay is a no-op.
  await claimPeriod(txDb, ctx, {
    subscriptionId: sub.id,
    periodIndex: sub.currentPeriodIndex,
    start: periodStart,
    end: periodEnd,
    invoiceId: invoice.id,
  });
  // Idempotent replay — an already-paid invoice for this period is returned as-is.
  if (invoice.paidAt) {
    // Self-heal: if a prior run paid this invoice but the period advance did not
    // land (a version-conflict race or crash after the paid CAS), re-drive the
    // idempotent paid-side effects so the subscription advances. No-op if already
    // advanced (sub has moved past this invoice's period).
    if (invoice.subscriptionId && sub.currentPeriodIndex === invoice.periodIndex) {
      await reconcilePaidSubEffects(txDb, ctx, invoice);
    }
    return { invoice, outcome: 'paid' };
  }

  const finalized = await finalizeInvoice(txDb, ctx, invoice.reference);
  if (finalized.paidAt) {
    // Zero-amount → paid in finalize (J8); reflect the subscription effects.
    await reconcilePaidSubEffects(txDb, ctx, finalized);
    return { invoice: finalized, outcome: 'paid' };
  }

  const method = await resolveCollectionMethod(txDb, ctx, sub);
  if (!method) {
    // send_invoice / method-less: the invoice is ISSUED for this period (an
    // accrual). Advance the period so the sub is not re-swept every tick; an
    // inbound transfer settles the open invoice out of band.
    await advancePeriod(txDb, ctx, sub, periodStart, periodEnd);
    return { invoice: finalized, outcome: 'open' };
  }

  const collected = await collectForInvoice(txDb, ctx, finalized, method);
  return { invoice: collected.invoice, outcome: collected.outcome };
}
