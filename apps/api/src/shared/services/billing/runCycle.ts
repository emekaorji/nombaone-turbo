
import { eq } from 'drizzle-orm';

import { invoicesTable } from '@nombaone/core-db/schema';
import { cadenceApproxMs } from '@nombaone/core-contracts/billing';
import { getOrgBillingSettings } from '@nombaone/sara/org';

import { enqueueCustomerEmail, loadCommsContext } from '../comms';
import { buildSubscriptionLine, createInvoice, finalizeInvoiceWithAdjustments } from '../invoices';
import { cancelAtBoundary, loadSubscriptionRow } from '../subscriptions';
import { applyDuePhase } from '../subscription-schedules';
import { ensureInvoiceCheckoutLink } from './actionLink';
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


import type { PriceInterval } from '@nombaone/core-contracts/types';
import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { InvoiceBillingReason } from '../invoices';
import type { CollectOutcome } from './types';

export interface RunCycleResult {
  /** `null` when the cycle ENDED the subscription instead of billing it (a
   *  cancel-at-period-end trip) — nothing was billed, so there is no invoice. */
  invoice: InvoiceRow | null;
  outcome: CollectOutcome | 'open' | 'canceled' | 'awaiting_payment';
  /**
   * The hosted-checkout link for an `awaiting_payment` cycle (a
   * `charge_automatically` subscription with NO stored payment method — the
   * storefront entry flow). The end user pays here; the settle webhook
   * activates the subscription and advances the period. Absent otherwise.
   */
  checkoutLink?: string | null;
  /**
   * Whole periods that had already ELAPSED, unbilled, when this run started — counted
   * from the period this run is about to bill.
   *
   * A period is billed IN ADVANCE, at its start. So `0` is the healthy steady state: the
   * period being billed is the one now in flight, it has not ended, and once it is billed
   * `next_billing_at` sits at its end, in the future. `>0` means the subscription is
   * BEHIND — N whole periods came and went unbilled (a worker outage, a paused sweep, a
   * laptop shut overnight on a `minute` cadence). **The caller must keep cycling until
   * this reaches 0**, or it stops one period short and leaves `next_billing_at` in the
   * past. `0` on the cancel path too, where no period is billed at all.
   *
   * This REPLACED a throwing catch-up guard. That guard counted periods and raised
   * `BILLING_CATCH_UP_LIMIT_EXCEEDED` *before billing anything*; the worker caught it and
   * returned WITHOUT advancing the period, so `next_billing_at` never moved and every
   * later sweep re-threw — the subscription was parked, silently, forever. The count is
   * cadence-blind (36 periods is 3 years of `month` but SIX HOURS of `minute × 10`), so a
   * routine deploy could kill a 10-minute plan. Progress is now guaranteed: the cycle
   * always bills and advances, and the CALLER bounds how much it drains per run.
   */
  periodsBehind: number;
}

/**
 * Counting is bounded so a pathologically stale row cannot spin the CPU. Calendar
 * cadences need the iteration (month-end snap-back is not arithmetic); a `minute`
 * cadence a year behind is ~525k steps of pure arithmetic, which is cheap — but the
 * ceiling keeps a corrupt anchor from looping unbounded.
 */
const MAX_BEHIND_SCAN = 100_000;

/**
 * Run ONE billing cycle for a subscription — the single orchestrator composed of
 * the primitives, and the exact unit 04's scheduler will call (no duplicated
 * billing logic). `createInvoice` → `finalizeInvoiceWithAdjustments` (discounts +
 * credits, 05) → `collectForInvoice`.
 * **Idempotent on `(subscription_id, period_index)`** (K2/J6): re-running returns
 * the existing invoice, never a second charge. A zero-amount invoice settles in
 * finalize with no rail call (J8); a `send_invoice`/method-less sub is left `open`
 * to await an inbound transfer.
 */
export interface RunCycleOptions {
  /** Threaded to the hosted-checkout link on an `awaiting_payment` first cycle
   *  (where the payer lands after the Nomba page) — the CREATE request's
   *  `callbackUrl`. Renewal-time awaiting cycles run without one. */
  checkoutCallbackUrl?: string;
}

export async function runCycle(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionRef: string,
  options: RunCycleOptions = {}
): Promise<RunCycleResult> {
  const loaded = await loadSubscriptionRow(txDb, ctx, subscriptionRef);
  // B10: apply any schedule phase due at THIS boundary BEFORE pricing, so the
  // change lands on the period about to bill (not at API-call time). Re-load the
  // subscription if a phase swapped its effective price.
  const applied = await applyDuePhase(txDb, ctx, {
    subscriptionId: loaded.id,
    periodIndex: loaded.currentPeriodIndex,
  });
  const sub = applied ? await loadSubscriptionRow(txDb, ctx, subscriptionRef) : loaded;

  // Cancel-at-period-end trips HERE, and only here: this call IS the moment the paid
  // coverage runs out and the next period would be billed. `cancelSubscription({ mode:
  // 'at_period_end' })` only raises the flag. Nothing read it before, so a subscription
  // the customer had already cancelled renewed forever. Return before claiming a period,
  // so no invoice row is minted and the sweep drops the row (canceled is not billable).
  if (sub.cancelAtPeriodEnd) {
    await cancelAtBoundary(txDb, ctx, sub);
    return { invoice: null, outcome: 'canceled', periodsBehind: 0 };
  }

  const price = await loadPriceById(txDb, ctx, sub.priceId);
  const item = await loadPrimarySubscriptionItem(txDb, ctx, sub.id);

  // Period window for the index being billed — anchor-based precise math (04a):
  // boundaries are `anchor + n·interval` with EOM snap-back / leap handling.
  const anchor =
    sub.billingCycleAnchor ?? computeAnchor(sub.currentPeriodStart ?? new Date(), price.interval);
  const { start: periodStart, end: periodEnd } = periodBounds(
    anchor,
    { interval: price.interval, intervalCount: price.intervalCount },
    sub.currentPeriodIndex
  );
  const billingReason: InvoiceBillingReason =
    sub.currentPeriodIndex === 0 ? 'subscription_create' : 'subscription_cycle';

  // How far behind is this row? Reported, never fatal — see `RunCycleResult.periodsBehind`.
  // The cycle ALWAYS bills and advances; the caller decides how much to drain per run.
  const now = Date.now();
  let periodsBehind = 0;
  while (periodsBehind < MAX_BEHIND_SCAN) {
    const bounds = periodBounds(
      anchor,
      { interval: price.interval, intervalCount: price.intervalCount },
      sub.currentPeriodIndex + periodsBehind
    );
    if (bounds.end.getTime() > now) break;
    periodsBehind += 1;
  }

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
    return { invoice, outcome: 'paid', periodsBehind };
  }

  // 05: finalize WITH adjustments — apply the subscription's active discount
  // (consuming a cycle) + oldest-first customer credit, resolving the fixed order
  // (subtotal → discount → credit → amount_due) and the J8 zero path. A cycle with
  // no discount/credit reduces to the plain finalize (amount_due === subtotal).
  //
  // 🔴 ONLY IF IT IS NOT ALREADY FINALIZED. `createInvoice` above is idempotent — it hands back the
  // EXISTING invoice for this period — so on any re-run of a period we reach here with an invoice
  // that was finalized by the previous run. That happens constantly and legitimately: the previous
  // run finalized, then the collection did not complete (the payer is still on the checkout page,
  // the rail errored, the worker crashed, the job was retried).
  //
  // Finalization is immutable by design (J2): a second call raises INVOICE_ALREADY_FINALIZED. So
  // calling it unconditionally meant the retry THREW — and since the period cannot advance until the
  // invoice is paid, every subsequent sweep re-enqueued the same period and threw again. The
  // subscription was bricked: it could never be charged again by any code path, and the failure
  // surfaced only as `[cron] job failed`. Re-finalizing is also not something we WANT: the discount
  // cycle and the customer credits were already consumed by the first finalize, and applying them
  // twice would corrupt the amount due.
  //
  // Finalize once; on a re-run, carry the already-finalized invoice straight through to collection.
  const finalized = invoice.finalizedAt
    ? invoice
    : (await finalizeInvoiceWithAdjustments(txDb, ctx, invoice.reference)).invoice;

  if (finalized.paidAt) {
    // Zero-amount (fully covered by discount/credit) → paid in finalize (J8);
    // reflect the subscription effects.
    await reconcilePaidSubEffects(txDb, ctx, finalized);
    return { invoice: finalized, outcome: 'paid', periodsBehind };
  }

  const method = await resolveCollectionMethod(txDb, ctx, sub);
  if (!method) {
    if (sub.collectionMethod === 'charge_automatically') {
      // HOSTED-CHECKOUT entry: a charge_automatically sub with NO stored method
      // (the storefront flow — the end user pays the first invoice on a Nomba
      // page, which also tokenizes their card for silent renewals). The period
      // must NOT advance here: advancing grants service BEFORE any money
      // arrived. The settle webhook activates + advances; the lifecycle sweep
      // expires an abandoned checkout at the incomplete window.
      const { invoice: withLink, checkoutLink } = await ensureInvoiceCheckoutLink(
        txDb,
        ctx,
        finalized,
        { callbackUrl: options.checkoutCallbackUrl }
      );
      return { invoice: withLink, outcome: 'awaiting_payment', checkoutLink, periodsBehind };
    }

    // send_invoice: the invoice is ISSUED for this period (an accrual — service
    // continues while the payer pushes funds). Advance the period so the sub is
    // not re-swept every tick; an inbound transfer settles the open invoice out
    // of band. The issue is made REAL here: a due date (so the overdue sweep can
    // start push-dunning — without one this invoice could sit open forever), a
    // hosted-checkout link, and the payment email. All idempotent per invoice.
    const issued = await issueSendInvoiceCycle(txDb, ctx, finalized, {
      interval: price.interval,
      intervalCount: price.intervalCount,
    });
    await advancePeriod(txDb, ctx, sub, periodStart, periodEnd);
    return { invoice: issued, outcome: 'open', periodsBehind };
  }

  const collected = await collectForInvoice(txDb, ctx, finalized, method);
  return { invoice: collected.invoice, outcome: collected.outcome, periodsBehind };
}

/**
 * Make a `send_invoice` cycle's invoice PAYABLE: stamp a due date (payer gets
 * `min(gracePeriodHours, one period)` — a 10-minute plan cannot enjoy a 3-day
 * grace on every cycle), mint + stamp the hosted-checkout link, and email the
 * customer the invoice. Idempotent: the due date is written once, the link is
 * reused from the stamp, and the email dedupes on the invoice reference.
 */
async function issueSendInvoiceCycle(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  cadence: { interval: PriceInterval; intervalCount: number }
): Promise<InvoiceRow> {
  let issued = invoice;

  if (!issued.dueDate) {
    const settings = await getOrgBillingSettings(txDb, ctx);
    const periodMs = cadenceApproxMs(cadence.interval, cadence.intervalCount);
    const graceMs = Math.min(settings.gracePeriodHours * 3_600_000, periodMs);
    const [stamped] = await txDb
      .update(invoicesTable)
      .set({ dueDate: new Date(Date.now() + graceMs) })
      .where(eq(invoicesTable.id, issued.id))
      .returning();
    issued = stamped ?? issued;
  }

  const { invoice: withLink, checkoutLink } = await ensureInvoiceCheckoutLink(txDb, ctx, issued);
  issued = withLink;

  const pi = (issued.metadata as Record<string, unknown> | null)?.payInstructions as
    | Record<string, unknown>
    | undefined;
  const comms = await loadCommsContext(txDb, ctx, issued);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'invoice_payment_link',
    to: comms.email,
    dedupeKey: `${issued.reference}:issued`,
    data: {
      amountKobo: issued.amountDue - issued.amountPaid,
      planName: comms.planName,
      merchantName: comms.merchantName,
      checkoutLink,
      dueAt: issued.dueDate ? new Date(issued.dueDate).toISOString() : undefined,
      bankName: pi?.bankName,
      accountNumber: pi?.accountNumber,
      accountName: pi?.accountName,
    },
  });

  return issued;
}
