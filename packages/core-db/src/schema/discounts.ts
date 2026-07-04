import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { couponsTable } from './coupons';
import { customersTable } from './customers';
import { organizationsTable } from './organizations';
import { createdAt, modeEnum, idPk, referenceCol, updatedAt } from './shared';
import { subscriptionsTable } from './subscriptions';

export const discountStatusEnum = pgEnum('discount_status', ['active', 'ended']);

/**
 * The APPLICATION of a coupon to one target — a customer OR a subscription (CHECK
 * exactly one). `cycles_remaining` counts down a `repeating` coupon. Partial unique
 * indexes enforce at most ONE active discount per target.
 */
export const discountsTable = pgTable(
  'discounts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => couponsTable.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').references(() => customersTable.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptionsTable.id, {
      onDelete: 'cascade',
    }),
    cyclesRemaining: smallint('cycles_remaining'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp('end_at', { withTimezone: true }),
    status: discountStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('discounts_reference_unique').on(table.reference),
    exactlyOneTarget: check(
      'discounts_exactly_one_target',
      sql`(${table.customerId} is not null)::int + (${table.subscriptionId} is not null)::int = 1`
    ),
    activeSubUnique: uniqueIndex('discounts_active_sub_unique')
      .on(table.subscriptionId)
      .where(sql`${table.status} = 'active' and ${table.subscriptionId} is not null`),
    activeCustomerUnique: uniqueIndex('discounts_active_customer_unique')
      .on(table.customerId)
      .where(sql`${table.status} = 'active' and ${table.customerId} is not null`),
    keysetIdx: index('discounts_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type DiscountRow = typeof discountsTable.$inferSelect;
export type DiscountInsert = typeof discountsTable.$inferInsert;
