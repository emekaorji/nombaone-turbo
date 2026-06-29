import { sql } from 'drizzle-orm';
import { bigint, check, index, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk } from './shared';
import { ledgerAccountsTable } from './ledger-accounts';
import { ledgerTransactionsTable } from './ledger-transactions';

export const ledgerDirectionEnum = pgEnum('ledger_direction', ['debit', 'credit']);

/**
 * One leg of a transaction. Append-only. `amount` is positive kobo; the
 * DIRECTION carries the sign (no negative amounts, no floats). Entries within a
 * transaction must balance (Σdebits = Σcredits) — enforced by `assertBalanced()`
 * in the domain before the row is written.
 */
export const ledgerEntriesTable = pgTable(
  'ledger_entries',
  {
    id: idPk(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => ledgerTransactionsTable.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccountsTable.id, { onDelete: 'restrict' }),
    direction: ledgerDirectionEnum('direction').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    txIdx: index('ledger_entries_tx_idx').on(table.transactionId),
    accountIdx: index('ledger_entries_account_idx').on(table.accountId),
    amountPositive: check('ledger_entries_amount_positive', sql`${table.amount} > 0`),
  })
);

export type LedgerEntryRow = typeof ledgerEntriesTable.$inferSelect;
export type LedgerEntryInsert = typeof ledgerEntriesTable.$inferInsert;
