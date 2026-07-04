import { and, between, eq, inArray } from 'drizzle-orm';

import {
  domainEventsTable,
  dunningAttemptsTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';

import type { DomainContext, InfraDb } from '../context';
import type { BillingMetricsData, DunningFunnelData } from '@nombaone/core-contracts/types';

/** Normalize a price's amount to a MONTHLY figure in kobo (integer, rounded). */
function toMonthlyKobo(amount: number, interval: string, intervalCount: number): number {
  const perOne =
    interval === 'year'
      ? amount / 12
      : interval === 'week'
        ? (amount * 52) / 12
        : interval === 'day'
          ? (amount * 365) / 12
          : amount; // month
  return Math.round(perOne / Math.max(1, intervalCount));
}

const ACTIVE_STATES = ['active', 'trialing'] as const;

/** MRR (kobo) — active/trialing subs' items, interval-normalized to a month. */
export async function computeMrr(db: InfraDb, ctx: DomainContext): Promise<number> {
  const rows = await db
    .select({
      unitAmount: subscriptionItemsTable.unitAmount,
      quantity: subscriptionItemsTable.quantity,
      interval: pricesTable.interval,
      intervalCount: pricesTable.intervalCount,
    })
    .from(subscriptionsTable)
    .innerJoin(subscriptionItemsTable, eq(subscriptionItemsTable.subscriptionId, subscriptionsTable.id))
    .innerJoin(pricesTable, eq(pricesTable.id, subscriptionItemsTable.priceId))
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        inArray(subscriptionsTable.status, [...ACTIVE_STATES])
      )
    );
  return rows.reduce((sum, r) => sum + toMonthlyKobo(r.unitAmount * r.quantity, r.interval, r.intervalCount), 0);
}

export async function countActive(db: InfraDb, ctx: DomainContext): Promise<number> {
  const rows = await db
    .select({ id: subscriptionsTable.id })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        inArray(subscriptionsTable.status, [...ACTIVE_STATES])
      )
    );
  return rows.length;
}

async function countEvents(
  db: InfraDb,
  ctx: DomainContext,
  type: string,
  from: Date,
  to: Date
): Promise<number> {
  const rows = await db
    .select({ id: domainEventsTable.id })
    .from(domainEventsTable)
    .where(
      and(
        eq(domainEventsTable.organizationId, ctx.organizationId),
        eq(domainEventsTable.mode, ctx.mode),
        eq(domainEventsTable.type, type),
        between(domainEventsTable.createdAt, from, to)
      )
    );
  return rows.length;
}

export async function dunningFunnel(db: InfraDb, ctx: DomainContext): Promise<DunningFunnelData> {
  const rows = await db
    .select({ status: dunningAttemptsTable.status })
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, ctx.organizationId),
        eq(dunningAttemptsTable.mode, ctx.mode)
      )
    );
  const f: DunningFunnelData = {
    scheduled: 0, attempting: 0, cardUpdateRequired: 0, rescheduled: 0, succeeded: 0, exhausted: 0,
  };
  for (const r of rows) {
    if (r.status === 'scheduled') f.scheduled += 1;
    else if (r.status === 'attempting') f.attempting += 1;
    else if (r.status === 'card_update_required') f.cardUpdateRequired += 1;
    else if (r.status === 'rescheduled') f.rescheduled += 1;
    else if (r.status === 'succeeded') f.succeeded += 1;
    else if (r.status === 'exhausted') f.exhausted += 1;
  }
  return f;
}

/** Compose all billing metrics for a tenant over a window (M ★). */
export async function computeBillingMetrics(
  db: InfraDb,
  ctx: DomainContext,
  window: { from: Date; to: Date }
): Promise<BillingMetricsData> {
  const { from, to } = window;
  const [mrrKobo, activeCount, voluntaryChurn, involuntaryChurn, paid, failed, recovered, pastDue, funnel] =
    await Promise.all([
      computeMrr(db, ctx),
      countActive(db, ctx),
      countEvents(db, ctx, 'subscription.canceled', from, to),
      countEvents(db, ctx, 'subscription.churned', from, to),
      countEvents(db, ctx, 'invoice.paid', from, to),
      countEvents(db, ctx, 'invoice.payment_failed', from, to),
      countEvents(db, ctx, 'invoice.payment_recovered', from, to),
      countEvents(db, ctx, 'invoice.payment_failed', from, to), // entries into past_due ≈ payment_failed count
      dunningFunnel(db, ctx),
    ]);

  const attempts = paid + failed;
  const failedChargeRate = attempts > 0 ? failed / attempts : 0;
  const dunningRecoveryRate = pastDue > 0 ? recovered / pastDue : 0;

  return {
    domain: 'billing_metrics',
    mrrInKobo: mrrKobo,
    activeCount,
    voluntaryChurn,
    involuntaryChurn,
    failedChargeRate,
    dunningRecoveryRate,
    dunningFunnel: funnel,
    windowFrom: from.toISOString(),
    windowTo: to.toISOString(),
  };
}
