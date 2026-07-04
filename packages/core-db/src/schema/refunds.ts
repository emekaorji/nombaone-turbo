import { sql } from 'drizzle-orm';
import { bigint, check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { settlementsTable } from './settlements';
import { createdAt, modeEnum, idPk, referenceCol } from './shared';

export const refundStatusEnum = pgEnum('refund_status', [
  'pending',
  'ledger_only',
  'succeeded',
  'failed',
]);

/**
 * A `refund` — one row per refund EVENT against a settlement (F3). Refunds return
 * ONLY the tenant's share (`net_to_tenant`); the platform fee is non-refundable, so
 * the ledger reversal debits `tenant_settlement` + credits `platform_revenue` only.
 * Append-only fact (no `updated_at`); cumulative-refunded for a settlement is
 * `SUM(refunds.amount_kobo)` — supports repeated partial refunds. `unique(merchant_tx_ref)`
 * is the durable, fail-closed idempotency guard (mirrors `settlements`). The provider
 * money-return is a separate step: a fresh refund lands `ledger_only` with a null
 * `provider_reference` and never claims `succeeded` on a fake.
 */
export const refundsTable = pgTable(
  'refunds',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlementsTable.id, { onDelete: 'cascade' }),
    subAccountRef: text('sub_account_ref').notNull(),
    amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
    merchantTxRef: text('merchant_tx_ref').notNull(),
    status: refundStatusEnum('status').notNull().default('ledger_only'),
    providerReference: text('provider_reference'),
    ledgerTransactionId: uuid('ledger_transaction_id'),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('refunds_reference_unique').on(table.reference),
    merchantTxRefUnique: uniqueIndex('refunds_merchant_tx_ref_unique').on(table.merchantTxRef),
    settlementIdx: index('refunds_settlement_idx').on(
      table.organizationId,
      table.mode,
      table.settlementId
    ),
    amountPositive: check('refunds_amount_positive', sql`${table.amountKobo} > 0`),
  })
);

export type RefundRow = typeof refundsTable.$inferSelect;
export type RefundInsert = typeof refundsTable.$inferInsert;
