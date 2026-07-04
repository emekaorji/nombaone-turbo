import { index, jsonb, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, modeEnum, idPk, referenceCol, updatedAt } from './shared';
import { subscriptionsTable } from './subscriptions';

export const subscriptionScheduleStatusEnum = pgEnum('subscription_schedule_status', [
  'active',
  'released',
  'canceled',
]);

/** One ordered phase: at period `startIndex` the subscription's effective price
 *  becomes `priceId` (a price UUID). `quantity` is reserved for 05 (seat deltas). */
export interface SubscriptionSchedulePhase {
  startIndex: number;
  priceId: string;
  quantity?: number;
  consumedAt?: string; // ISO — stamped when the sweep applies the phase at the boundary
}

/**
 * A subscription_schedule (contract C.1): an ordered list of future-dated phases
 * applied **at the next cycle boundary** by the sweep (B10), not at API-call time.
 */
export const subscriptionSchedulesTable = pgTable(
  'subscription_schedules',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: 'cascade' }),
    status: subscriptionScheduleStatusEnum('status').notNull().default('active'),
    phases: jsonb('phases').$type<SubscriptionSchedulePhase[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('subscription_schedules_reference_unique').on(table.reference),
    keysetIdx: index('subscription_schedules_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
    subscriptionIdx: index('subscription_schedules_subscription_idx').on(
      table.organizationId,
      table.mode,
      table.subscriptionId
    ),
  })
);

export type SubscriptionScheduleRow = typeof subscriptionSchedulesTable.$inferSelect;
export type SubscriptionScheduleInsert = typeof subscriptionSchedulesTable.$inferInsert;
