import { sql } from 'drizzle-orm';
import { bigint, check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

export const ledgerAccountKindEnum = pgEnum('ledger_account_kind', [
  'asset',
  'liability',
  'revenue',
  'expense',
  'system',
]);

/**
 * A double-entry ledger account. `balance` is a MATERIALIZED counter (kobo)
 * updated atomically inside the posting transaction, so reads are O(1) instead of
 * summing entries. `key` names a system/well-known account (e.g. `platform_fees`)
 * — the partial unique index enforces ONE such account per org+mode
 * ("one-of-kind-per-tenant").
 */
export const ledgerAccountsTable = pgTable(
  'ledger_accounts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    kind: ledgerAccountKindEnum('kind').notNull(),
    key: text('key'),
    currency: text('currency').notNull().default('NGN'),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('ledger_accounts_reference_unique').on(table.reference),
    keyUnique: uniqueIndex('ledger_accounts_key_unique')
      .on(table.organizationId, table.mode, table.key)
      .where(sql`${table.key} is not null`),
    orgEnvIdx: index('ledger_accounts_org_env_idx').on(table.organizationId, table.mode),
    /**
     * 🔒 A MERCHANT CAN NEVER BE OVERDRAWN. `tenant_settlement:{ref}` is what we owe
     * a merchant; paying out more than that balance would be paying away money that
     * isn't theirs (i.e. another merchant's).
     *
     * The payout path already guards this with a `FOR UPDATE` row lock and an
     * availability check — but that is application logic, and application logic is
     * exactly what has been wrong repeatedly on this money path. This CHECK is the
     * structural backstop: a transaction that would drive a tenant balance below zero
     * ABORTS in the database, whatever the code believed. Correctness here does not
     * depend on us being careful.
     */
    tenantNeverNegative: check(
      'ledger_accounts_tenant_balance_non_negative',
      sql`${table.key} IS NULL OR ${table.key} NOT LIKE 'tenant_settlement:%' OR ${table.balance} >= 0`
    ),
  })
);

export type LedgerAccountRow = typeof ledgerAccountsTable.$inferSelect;
export type LedgerAccountInsert = typeof ledgerAccountsTable.$inferInsert;
