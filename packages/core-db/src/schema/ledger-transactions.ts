import { index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

export const ledgerTransactionKindEnum = pgEnum('ledger_transaction_kind', [
  'charge',
  'reversal',
  'adjustment',
  'settlement',
  'fee',
]);

/**
 * An append-only double-entry transaction. Immutable: a correction is a NEW
 * transaction (a reversal links back via `reverses_transaction_id`), never an
 * edit. No `updated_at` — these rows are facts.
 */
export const ledgerTransactionsTable = pgTable(
  'ledger_transactions',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    kind: ledgerTransactionKindEnum('kind').notNull(),
    reversesTransactionId: uuid('reverses_transaction_id'),
    memo: text('memo'),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('ledger_transactions_reference_unique').on(table.reference),
    keysetIdx: index('ledger_transactions_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type LedgerTransactionRow = typeof ledgerTransactionsTable.$inferSelect;
export type LedgerTransactionInsert = typeof ledgerTransactionsTable.$inferInsert;
