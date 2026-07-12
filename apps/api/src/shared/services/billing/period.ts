import { and, eq } from 'drizzle-orm';

import { subscriptionsTable, type SubscriptionRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

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
      // The due-selection cursor: the next renewal fires when the just-paid period
      // ends (04 sweep reads next_billing_at ≤ now).
      nextBillingAt: paidEnd,
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
