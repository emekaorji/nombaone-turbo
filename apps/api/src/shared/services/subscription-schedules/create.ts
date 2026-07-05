import { and, eq } from 'drizzle-orm';

import {
  pricesTable,
  subscriptionSchedulesTable,
  subscriptionsTable,
  type SubscriptionSchedulePhase,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { getScheduleByReference, loadActiveSchedule } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CreateScheduleInput, SubscriptionScheduleResponseData } from './types';

/**
 * Schedule a plan/price change to take effect AT THE NEXT CYCLE BOUNDARY (B10), not
 * now. `effectiveAt: 'next_cycle'` resolves to `current_period_index + 1`. A phase
 * is added to the subscription's single active schedule (created on first use);
 * adding another phase at the same boundary replaces it. Emits `subscription.updated`.
 */
export async function createSchedule(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateScheduleInput
): Promise<SubscriptionScheduleResponseData> {
  const [sub] = await txDb
    .select({ id: subscriptionsTable.id, currentPeriodIndex: subscriptionsTable.currentPeriodIndex })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        eq(subscriptionsTable.reference, input.subscriptionRef)
      )
    )
    .limit(1);
  if (!sub) {
    throw AppError.NotFound(
      'subscription not found',
      { reference: input.subscriptionRef },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }

  const [price] = await txDb
    .select({ id: pricesTable.id })
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.reference, input.priceRef)
      )
    )
    .limit(1);
  if (!price) {
    throw AppError.NotFound(
      'price not found',
      { reference: input.priceRef },
      NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND
    );
  }

  const startIndex = sub.currentPeriodIndex + 1;
  const phase: SubscriptionSchedulePhase = {
    startIndex,
    priceId: price.id,
    ...(input.quantity ? { quantity: input.quantity } : {}),
  };

  const existing = await loadActiveSchedule(txDb, ctx, sub.id);
  if (existing) {
    const phases = [...existing.phases.filter((p) => p.startIndex !== startIndex), phase].sort(
      (a, b) => a.startIndex - b.startIndex
    );
    await txDb
      .update(subscriptionSchedulesTable)
      .set({ phases })
      .where(eq(subscriptionSchedulesTable.id, existing.id));
    await emitEvent(txDb, {
      ...ctx,
      type: 'subscription.updated',
      payload: { reference: existing.reference, subscriptionRef: input.subscriptionRef },
    });
    return getScheduleByReference(txDb, ctx, existing.reference);
  }

  const reference = mintReference('SCH');
  await txDb.insert(subscriptionSchedulesTable).values({
    reference,
    organizationId: ctx.organizationId,
    mode: ctx.mode,
    subscriptionId: sub.id,
    status: 'active',
    phases: [phase],
  });
  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference, subscriptionRef: input.subscriptionRef },
  });
  return getScheduleByReference(txDb, ctx, reference);
}
