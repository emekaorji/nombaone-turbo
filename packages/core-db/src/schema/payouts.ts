import { sql } from 'drizzle-orm';
import { bigint, check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, referenceCol } from './shared';

export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'ledger_posted',
  'succeeded',
  'failed',
]);

/**
 * A `payout` — a tenant-level withdrawal of settled funds to the tenant's bank
 * (the escrow model: `withdrawable = balance − lockedLast3h − minBuffer`). The
 * ledger debit of `tenant_settlement` is posted first (guarded by `unique(merchant_tx_ref)`);
 * the Nomba `bankTransfer` provider leg is flag-gated (`NOMBA_PAYOUT_ENABLED`) and, on
 * failure, compensated by a reversing ledger entry so tenant funds are never stranded.
 * Append-only fact; `status` records the provider leg outcome.
 */
export const payoutsTable = pgTable(
  'payouts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    subAccountRef: text('sub_account_ref').notNull(),
    amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
    bankCode: text('bank_code').notNull(),
    accountNumber: text('account_number').notNull(),
    resolvedAccountName: text('resolved_account_name'),
    merchantTxRef: text('merchant_tx_ref').notNull(),
    status: payoutStatusEnum('status').notNull().default('pending'),
    providerReference: text('provider_reference'),
    failureReason: text('failure_reason'),
    ledgerTransactionId: uuid('ledger_transaction_id'),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('payouts_reference_unique').on(table.reference),
    merchantTxRefUnique: uniqueIndex('payouts_merchant_tx_ref_unique').on(table.merchantTxRef),
    keysetIdx: index('payouts_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
    amountPositive: check('payouts_amount_positive', sql`${table.amountKobo} > 0`),
  })
);

export type PayoutRow = typeof payoutsTable.$inferSelect;
export type PayoutInsert = typeof payoutsTable.$inferInsert;
