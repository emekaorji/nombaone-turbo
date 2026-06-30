import { and, eq } from 'drizzle-orm';

import { subscriptionSchedulesTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { getScheduleByReference, loadActiveSchedule } from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { SubscriptionScheduleResponseData } from './types';

/** Release (cancel) the active schedule for a subscription. Emits `subscription.updated`. */
export async function cancelSchedule(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionRef: string
): Promise<SubscriptionScheduleResponseData> {
  const [sub] = await txDb
    .select({ id: subscriptionsTable.id })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.environment, ctx.environment),
        eq(subscriptionsTable.reference, subscriptionRef)
      )
    )
    .limit(1);
  if (!sub) {
    throw AppError.NotFound(
      'subscription not found',
      { reference: subscriptionRef },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }

  const schedule = await loadActiveSchedule(txDb, ctx, sub.id);
  if (!schedule) {
    throw AppError.NotFound(
      'no active schedule for subscription',
      { reference: subscriptionRef },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_NOT_FOUND
    );
  }

  await txDb
    .update(subscriptionSchedulesTable)
    .set({ status: 'canceled' })
    .where(eq(subscriptionSchedulesTable.id, schedule.id));
  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference: schedule.reference, subscriptionRef },
  });
  return getScheduleByReference(txDb, ctx, schedule.reference);
}
