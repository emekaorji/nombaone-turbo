import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';
import { customersTable } from './customers';
import { organizationsTable } from './organizations';
import { subscriptionsTable } from './subscriptions';

/**
 * Invoice = what is owed for one billing period. **No money-status column** —
 * status is DERIVED (`draft|open|paid|void|uncollectible`) from
 * `(finalized_at, voided_at, paid_at, amount_due, AR balance)`. Immutable once
 * finalized: `total`/`amount_due` are frozen by the domain `assertNotFinalized`.
 * **`unique(subscription_id, period_index)` is the structural no-double-charge
 * guard (J6/K2):** the Nth period can have exactly one invoice. Money is kobo.
 */
export const billingReasonEnum = pgEnum('billing_reason', [
  'subscription_create',
  'subscription_cycle',
  'subscription_update',
  'manual',
]);

export const invoicesTable = pgTable(
  'invoices',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'restrict' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptionsTable.id, {
      onDelete: 'set null',
    }),
    periodIndex: integer('period_index'),
    billingReason: billingReasonEnum('billing_reason').notNull(),
    currency: text('currency').notNull().default('NGN'),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
    discountTotal: bigint('discount_total', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull(),
    amountDue: bigint('amount_due', { mode: 'number' }).notNull(),
    amountPaid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    ledgerTransactionId: uuid('ledger_transaction_id'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('invoices_reference_unique').on(table.reference),
    // One finalized invoice per subscription period — the structural no-double-charge guard.
    subscriptionPeriodUnique: uniqueIndex('invoices_subscription_period_unique')
      .on(table.subscriptionId, table.periodIndex)
      .where(sql`${table.subscriptionId} is not null`),
    keysetIdx: index('invoices_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
    customerIdx: index('invoices_customer_idx').on(
      table.organizationId,
      table.environment,
      table.customerId
    ),
  })
);

export type InvoiceRow = typeof invoicesTable.$inferSelect;
export type InvoiceInsert = typeof invoicesTable.$inferInsert;
