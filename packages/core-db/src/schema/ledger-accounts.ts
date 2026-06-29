import { sql } from 'drizzle-orm';
import { bigint, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol } from './shared';
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
 * — the partial unique index enforces ONE such account per org+environment
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
    environment: environmentEnum('environment').notNull(),
    kind: ledgerAccountKindEnum('kind').notNull(),
    key: text('key'),
    currency: text('currency').notNull().default('NGN'),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('ledger_accounts_reference_unique').on(table.reference),
    keyUnique: uniqueIndex('ledger_accounts_key_unique')
      .on(table.organizationId, table.environment, table.key)
      .where(sql`${table.key} is not null`),
    orgEnvIdx: index('ledger_accounts_org_env_idx').on(table.organizationId, table.environment),
  })
);

export type LedgerAccountRow = typeof ledgerAccountsTable.$inferSelect;
export type LedgerAccountInsert = typeof ledgerAccountsTable.$inferInsert;
