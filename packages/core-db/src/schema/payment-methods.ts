import { sql } from 'drizzle-orm';
import {
  boolean,
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

import { createdAt, modeEnum, idPk, referenceCol, updatedAt } from './shared';
import { customersTable } from './customers';
import { organizationsTable } from './organizations';

/**
 * Payment method = a customer's instance on one rail. It stores ONLY Nomba
 * references — a card `token_key`, a mandate id, or a virtual-account ref — plus
 * provider-returned display fields (`brand`/`last4`/`exp*`). **There is no column
 * that could hold a PAN: N1 is structural, not a check.** `is_default` is unique
 * per (customer, mode) via a partial index. The capture lifecycle lives in
 * `status` (`setup_pending`/`consent_pending` → `active` → `removed`/`expired`).
 */
export const paymentMethodKindEnum = pgEnum('payment_method_kind', [
  'card',
  'mandate',
  'virtual_account',
]);
export const paymentMethodStatusEnum = pgEnum('payment_method_status', [
  'setup_pending',
  'consent_pending',
  'active',
  'removed',
  'expired',
]);

export const paymentMethodsTable = pgTable(
  'payment_methods',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    kind: paymentMethodKindEnum('kind').notNull(),
    status: paymentMethodStatusEnum('status').notNull().default('setup_pending'),
    // Card rail — provider token + display fields only (NEVER a PAN).
    tokenKey: text('token_key'),
    brand: text('brand'),
    last4: text('last4'),
    expMonth: integer('exp_month'),
    expYear: integer('exp_year'),
    tokenExpiry: text('token_expiry'),
    // Mandate rail.
    mandateId: text('mandate_id'),
    // Transfer rail (virtual account).
    accountRef: text('account_ref'),
    // 04 lifecycle sweep: the payment-method-expiring notice idempotency stamp.
    expiringNotifiedAt: timestamp('expiring_notified_at', { withTimezone: true }),
    isDefault: boolean('is_default').notNull().default(false),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('payment_methods_reference_unique').on(table.reference),
    // At most one default method per customer per environment.
    defaultUnique: uniqueIndex('payment_methods_default_unique')
      .on(table.customerId, table.mode)
      .where(sql`${table.isDefault}`),
    // One row per (customer, card token): the invoice-branch token capture is
    // idempotent under webhook replays because the second insert conflicts here.
    customerTokenUnique: uniqueIndex('payment_methods_customer_token_unique')
      .on(table.customerId, table.tokenKey)
      .where(sql`${table.tokenKey} IS NOT NULL`),
    customerIdx: index('payment_methods_customer_idx').on(
      table.organizationId,
      table.mode,
      table.customerId
    ),
    keysetIdx: index('payment_methods_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type PaymentMethodRow = typeof paymentMethodsTable.$inferSelect;
export type PaymentMethodInsert = typeof paymentMethodsTable.$inferInsert;
