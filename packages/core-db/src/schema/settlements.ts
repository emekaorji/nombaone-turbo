import { sql } from 'drizzle-orm';
import { bigint, check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { customersTable } from './customers';
import { invoicesTable } from './invoices';
import { organizationsTable } from './organizations';
import { createdAt, modeEnum, idPk, referenceCol } from './shared';

export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',
  'settled',
  'reconciled',
  'failed',
  'refunded',
]);

/**
 * A `settlement` — the artifact of an inline split at collection (H5 ★). Each
 * verified collection separates the tenant share (into their Nomba sub-account) from
 * the platform fee (the remainder on the parent), recorded here with a matching
 * balanced ledger posting. Append-only fact (no `updated_at`, like
 * `ledger_transactions`). `unique(merchant_tx_ref)` + `unique(invoice_id)` make a
 * duplicate settlement structurally impossible (K2); the CHECK enforces the
 * kobo-exact split invariant `gross = fee + net` structurally (L4).
 */
export const settlementsTable = pgTable(
  'settlements',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoicesTable.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    subAccountRef: text('sub_account_ref').notNull(),
    splitReference: text('split_reference'),
    merchantTxRef: text('merchant_tx_ref').notNull(),
    grossKobo: bigint('gross_kobo', { mode: 'number' }).notNull(),
    platformFeeKobo: bigint('platform_fee_kobo', { mode: 'number' }).notNull(),
    netToTenantKobo: bigint('net_to_tenant_kobo', { mode: 'number' }).notNull(),
    ledgerTransactionId: uuid('ledger_transaction_id'),
    status: settlementStatusEnum('status').notNull().default('settled'),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('settlements_reference_unique').on(table.reference),
    merchantTxRefUnique: uniqueIndex('settlements_merchant_tx_ref_unique').on(table.merchantTxRef),
    invoiceUnique: uniqueIndex('settlements_invoice_unique').on(table.invoiceId),
    keysetIdx: index('settlements_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
    statusIdx: index('settlements_status_idx').on(
      table.organizationId,
      table.mode,
      table.status
    ),
    splitBalances: check(
      'settlements_split_balances',
      sql`${table.grossKobo} = ${table.platformFeeKobo} + ${table.netToTenantKobo} and ${table.platformFeeKobo} >= 0 and ${table.netToTenantKobo} >= 0`
    ),
  })
);

export type SettlementRow = typeof settlementsTable.$inferSelect;
export type SettlementInsert = typeof settlementsTable.$inferInsert;
