import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { invoicesTable } from './invoices';
import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk } from './shared';
import { subscriptionsTable } from './subscriptions';

/**
 * The idempotency CLAIM SPINE (04 D.1). One row = "billing period N of this
 * subscription has been claimed for billing". The **`unique(subscription_id,
 * period_index)`** index is the STRUCTURAL double-bill guard (B6/B8/K2/K4): the
 * sweep's first act for a due subscription is `INSERT … ON CONFLICT
 * (subscription_id, period_index) DO NOTHING RETURNING`; a replay, a second worker,
 * or an overlapping tick that loses the race gets zero rows back and does **nothing
 * further** — no invoice, no charge. This holds even if every advisory lock and
 * cache fails.
 */
export const subscriptionPeriodsTable = pgTable(
  'subscription_periods',
  {
    id: idPk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: 'cascade' }),
    periodIndex: integer('period_index').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    invoiceId: uuid('invoice_id').references(() => invoicesTable.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => ({
    subscriptionPeriodUnique: uniqueIndex('subscription_periods_sub_period_unique').on(
      table.subscriptionId,
      table.periodIndex
    ),
    dueIdx: index('subscription_periods_due_idx').on(
      table.organizationId,
      table.environment,
      table.periodEnd
    ),
    periodIndexNonNegative: check(
      'subscription_periods_period_index_nonneg',
      sql`${table.periodIndex} >= 0`
    ),
  })
);

export type SubscriptionPeriodRow = typeof subscriptionPeriodsTable.$inferSelect;
export type SubscriptionPeriodInsert = typeof subscriptionPeriodsTable.$inferInsert;
