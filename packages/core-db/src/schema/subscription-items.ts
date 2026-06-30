import { bigint, index, integer, jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';
import { organizationsTable } from './organizations';
import { pricesTable } from './prices';
import { subscriptionsTable } from './subscriptions';

/**
 * A priced line on a subscription (seat/quantity). `unit_amount` is captured from
 * the price at attach (kobo), so 05's proration reads it without re-resolving the
 * price. One subscription has one item this phase; multi-item / seat changes are 05.
 */
export const subscriptionItemsTable = pgTable(
  'subscription_items',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: 'cascade' }),
    priceId: uuid('price_id')
      .notNull()
      .references(() => pricesTable.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
    unitAmount: bigint('unit_amount', { mode: 'number' }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('subscription_items_reference_unique').on(table.reference),
    subscriptionIdx: index('subscription_items_subscription_idx').on(
      table.organizationId,
      table.environment,
      table.subscriptionId
    ),
  })
);

export type SubscriptionItemRow = typeof subscriptionItemsTable.$inferSelect;
export type SubscriptionItemInsert = typeof subscriptionItemsTable.$inferInsert;
