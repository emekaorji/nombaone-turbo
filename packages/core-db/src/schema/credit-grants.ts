import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { customersTable } from './customers';
import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';

export const creditGrantSourceEnum = pgEnum('credit_grant_source', [
  'downgrade_proration',
  'manual',
  'goodwill',
  'coupon',
]);

/**
 * A per-customer credit grant — the AUDIT + ORDERING record for the credit balance
 * (the balance itself is materialized in the `customer_credit` ledger account, read
 * O(1)). `remaining` (≤ `amount`) decrements as the grant is consumed. The
 * `(org, env, customer, created_at asc, id asc)` index is the deterministic
 * **oldest-first** application order (C8 ★).
 */
export const creditGrantsTable = pgTable(
  'credit_grants',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(), // positive kobo granted
    remaining: bigint('remaining', { mode: 'number' }).notNull(), // positive, ≤ amount
    source: creditGrantSourceEnum('source').notNull(),
    sourceReference: text('source_reference'),
    ledgerTransactionId: uuid('ledger_transaction_id'),
    // Item 8: a voided grant — the unconsumed `remaining` was reversed in the ledger
    // and `remaining` set to 0. Distinguishes a voided grant from a fully-consumed one.
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('credit_grants_reference_unique').on(table.reference),
    oldestFirstIdx: index('credit_grants_oldest_first_idx').on(
      table.organizationId,
      table.environment,
      table.customerId,
      table.createdAt.asc(),
      table.id.asc()
    ),
    remainingRange: check(
      'credit_grants_remaining_range',
      sql`${table.remaining} >= 0 and ${table.remaining} <= ${table.amount}`
    ),
  })
);

export type CreditGrantRow = typeof creditGrantsTable.$inferSelect;
export type CreditGrantInsert = typeof creditGrantsTable.$inferInsert;
