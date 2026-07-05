import { loadSubscriptionRow } from '../subscriptions';
import { loadActiveSchedule } from '../subscription-schedules';
import { loadPriceById, loadPrimarySubscriptionItem } from './effects';
import { computeAnchor, periodBounds } from './scheduling';

import type { UpcomingInvoiceResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { InvoiceBillingReason } from '../invoices';

/**
 * Preview the next invoice a subscription will generate — pure period math + the
 * effective price for the upcoming period (a scheduled phase at this boundary if
 * one applies, else the current price). Persists nothing (B10 / upcoming-invoice).
 */
export async function getUpcomingInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionRef: string
): Promise<UpcomingInvoiceResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, subscriptionRef);
  const index = sub.currentPeriodIndex;
  const item = await loadPrimarySubscriptionItem(txDb, ctx, sub.id);

  let effectivePriceId = sub.priceId;
  let quantity = item.quantity;
  const schedule = await loadActiveSchedule(txDb, ctx, sub.id);
  if (schedule) {
    const phase = schedule.phases.find((p) => p.startIndex === index && !p.consumedAt);
    if (phase) {
      effectivePriceId = phase.priceId;
      if (phase.quantity) quantity = phase.quantity;
    }
  }

  const price = await loadPriceById(txDb, ctx, effectivePriceId);
  const anchor = sub.billingCycleAnchor ?? computeAnchor(sub.currentPeriodStart ?? new Date());
  const { start, end } = periodBounds(
    anchor,
    { interval: price.interval, intervalCount: price.intervalCount },
    index
  );
  const amount = price.unitAmount * quantity;
  const billingReason: InvoiceBillingReason =
    index === 0 ? 'subscription_create' : 'subscription_cycle';

  return {
    domain: 'upcoming_invoice',
    subscriptionId: sub.reference,
    periodIndex: index,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    billingReason,
    subtotalInKobo: amount,
    totalInKobo: amount,
    amountDueInKobo: amount,
    currency: 'NGN',
    lineItems: [
      {
        id: 'upcoming',
        kind: 'subscription',
        description: `${price.reference} × ${quantity}`,
        amountInKobo: amount,
        quantity,
      },
    ],
    mode: sub.mode,
  };
}
