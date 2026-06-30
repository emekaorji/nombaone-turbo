import type { InvoiceRow } from '@nombaone/core-db/schema';

import { buildSubscriptionLine, createInvoice, finalizeInvoice } from '../invoices';
import { loadSubscriptionRow } from '../subscriptions';
import { collectForInvoice } from './collectForInvoice';
import {
  applyPaidSubEffects,
  loadPriceById,
  loadPrimarySubscriptionItem,
  resolveCollectionMethod,
} from './effects';
import { rollPeriod } from './period';

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

  // Period window for the index being billed (simple roll; 04 owns anchor math).
  const anchor = sub.currentPeriodStart ?? sub.billingCycleAnchor ?? new Date();
  const periodStart =
    sub.currentPeriodIndex === 0 ? (sub.trialEnd ?? anchor) : (sub.currentPeriodEnd ?? anchor);
  const periodEnd = rollPeriod(periodStart, price.interval, price.intervalCount);
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
  // Idempotent replay — an already-paid invoice for this period is returned as-is.
  if (invoice.paidAt) return { invoice, outcome: 'paid' };

  const finalized = await finalizeInvoice(txDb, ctx, invoice.reference);
  if (finalized.paidAt) {
    // Zero-amount → paid in finalize (J8); reflect the subscription effects.
    await applyPaidSubEffects(txDb, ctx, finalized);
    return { invoice: finalized, outcome: 'paid' };
  }

  const method = await resolveCollectionMethod(txDb, ctx, sub);
  if (!method) {
    // send_invoice or a method-less subscription: leave open, await an inbound transfer.
    return { invoice: finalized, outcome: 'open' };
  }

  const collected = await collectForInvoice(txDb, ctx, finalized, method);
  return { invoice: collected.invoice, outcome: collected.outcome };
}
