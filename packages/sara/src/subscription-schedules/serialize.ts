import type { SubscriptionScheduleRow } from '@nombaone/core-db/schema';
import type { SubscriptionSchedulePhaseData, SubscriptionScheduleResponseData } from './types';

/**
 * Serialize a schedule row to the DTO. Phase `priceId`s are stored as price UUIDs;
 * `priceRefs` maps each to its public reference.
 */
export const serializeSchedule = (
  row: SubscriptionScheduleRow,
  subscriptionRef: string,
  priceRefs: Map<string, string>
): SubscriptionScheduleResponseData => ({
  id: row.reference,
  subscriptionId: subscriptionRef,
  status: row.status,
  phases: row.phases.map(
    (p): SubscriptionSchedulePhaseData => ({
      startIndex: p.startIndex,
      priceId: priceRefs.get(p.priceId) ?? p.priceId,
      quantity: p.quantity,
      consumedAt: p.consumedAt ?? null,
    })
  ),
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});
