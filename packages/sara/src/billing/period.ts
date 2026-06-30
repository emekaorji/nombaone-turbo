import { and, eq } from 'drizzle-orm';

import { subscriptionsTable, type PriceRow, type SubscriptionRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraTxDb } from '../context';

type PriceInterval = PriceRow['interval'];

/**
 * Roll a period start forward by `count × interval`, in UTC. **NAIVE** — calendar
 * anchoring, end-of-month clamping and leap handling are 04's scheduler; this is
 * the simple roll the single cycle uses to bound an invoice's period. Pure.
 */
export function rollPeriod(start: Date, interval: PriceInterval, count: number): Date {
  const d = new Date(start.getTime());
  switch (interval) {
    case 'day':
      d.setUTCDate(d.getUTCDate() + count);
      break;
    case 'week':
      d.setUTCDate(d.getUTCDate() + 7 * count);
      break;
    case 'month':
      d.setUTCMonth(d.getUTCMonth() + count);
      break;
    case 'year':
      d.setUTCFullYear(d.getUTCFullYear() + count);
      break;
  }
  return d;
}

/**
 * Record the just-paid period as the subscription's current window and increment
 * `current_period_index`, under the **optimistic version guard** (a stale version
 * → `SUBSCRIPTION_VERSION_CONFLICT`). The cancel-at-period-end boundary trip and
 * the precise anchor math are 04's scheduler — this only reflects what was billed.
 */
export async function advancePeriod(
  txDb: InfraTxDb,
  _ctx: DomainContext,
  sub: SubscriptionRow,
  paidStart: Date,
  paidEnd: Date
): Promise<SubscriptionRow> {
  const [updated] = await txDb
    .update(subscriptionsTable)
    .set({
      currentPeriodStart: paidStart,
      currentPeriodEnd: paidEnd,
      currentPeriodIndex: sub.currentPeriodIndex + 1,
      version: sub.version + 1,
    })
    .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
    .returning();
  if (!updated) {
    throw AppError.Conflict(
      'subscription was modified concurrently; retry',
      { reference: sub.reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
    );
  }
  return updated;
}
