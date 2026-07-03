import { and, eq, inArray } from 'drizzle-orm';

import {
  pricesTable,
  subscriptionSchedulesTable,
  subscriptionsTable,
  type SubscriptionScheduleRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { serializeSchedule } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '../context';
import type { SubscriptionScheduleResponseData } from './types';

/** The single active schedule for a subscription (at most one), or null. */
export async function loadActiveSchedule(
  scope: InfraReadScope,
  ctx: DomainContext,
  subscriptionId: string
): Promise<SubscriptionScheduleRow | null> {
  const [row] = await scope
    .select()
    .from(subscriptionSchedulesTable)
    .where(
      and(
        eq(subscriptionSchedulesTable.organizationId, ctx.organizationId),
        eq(subscriptionSchedulesTable.environment, ctx.environment),
        eq(subscriptionSchedulesTable.subscriptionId, subscriptionId),
        eq(subscriptionSchedulesTable.status, 'active')
      )
    )
    .limit(1);
  return row ?? null;
}

/** Resolve each phase's price UUID → its public reference for the DTO. */
async function resolvePhasePriceRefs(
  db: InfraDb,
  ctx: DomainContext,
  row: SubscriptionScheduleRow
): Promise<Map<string, string>> {
  const ids = [...new Set(row.phases.map((p) => p.priceId))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const prices = await db
    .select({ id: pricesTable.id, reference: pricesTable.reference })
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.environment, ctx.environment),
        inArray(pricesTable.id, ids)
      )
    );
  for (const p of prices) map.set(p.id, p.reference);
  return map;
}

async function serialize(
  db: InfraDb,
  ctx: DomainContext,
  row: SubscriptionScheduleRow
): Promise<SubscriptionScheduleResponseData> {
  const [sub] = await db
    .select({ reference: subscriptionsTable.reference })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, row.subscriptionId))
    .limit(1);
  const priceRefs = await resolvePhasePriceRefs(db, ctx, row);
  return serializeSchedule(row, sub?.reference ?? '', priceRefs);
}

export async function getScheduleByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionScheduleResponseData> {
  const [row] = await db
    .select()
    .from(subscriptionSchedulesTable)
    .where(
      and(
        eq(subscriptionSchedulesTable.organizationId, ctx.organizationId),
        eq(subscriptionSchedulesTable.environment, ctx.environment),
        eq(subscriptionSchedulesTable.reference, reference)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound(
      'subscription schedule not found',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_NOT_FOUND
    );
  }
  return serialize(db, ctx, row);
}

/** The active schedule for a subscription (by its reference) → DTO, or 404. */
export async function getActiveScheduleForSubscription(
  db: InfraDb,
  ctx: DomainContext,
  subscriptionRef: string
): Promise<SubscriptionScheduleResponseData> {
  const [sub] = await db
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
  const row = await loadActiveSchedule(db, ctx, sub.id);
  if (!row) {
    throw AppError.NotFound(
      'no active schedule for subscription',
      { reference: subscriptionRef },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_NOT_FOUND
    );
  }
  return serialize(db, ctx, row);
}
