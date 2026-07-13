import { sql } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, idPk, modeEnum, referenceCol, updatedAt } from './shared';

export const payoutAccountStatusEnum = pgEnum('payout_account_status', [
  'active',
  'disabled',
]);

/**
 * WHERE A MERCHANT'S MONEY GOES — their own Nigerian bank account.
 *
 * Money collects into the ONE platform Nomba account and the merchant's share is a
 * balance in our ledger (`tenant_settlement:{accountRef}`). This row is the only way
 * that balance can ever leave: it names the bank account we transfer it to.
 *
 * Deliberately NOT asked for at signup. A merchant signs up, starts billing, and is
 * only asked for a bank account the first time they withdraw — which is the only
 * moment it is actually needed. They never leave our product to get it, and they never
 * touch Nomba.
 *
 * 🔒 `accountName` is NEVER typed by the merchant. It is whatever
 * `POST /v1/transfers/bank/lookup` (NIBSS name enquiry) says the account holder is
 * called, and the row cannot be created without it. That is what makes a payout to an
 * unverified destination structurally impossible, and it is also why the merchant sees
 * "We found: ADEBAYO STORES LTD — is this you?" instead of a form field they could get
 * wrong (or lie in).
 */
export const orgPayoutAccountsTable = pgTable(
  'org_payout_accounts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),

    /** NIBSS bank code, from Nomba's bank list (`GET /v1/transfers/banks`) — never hand-typed. */
    bankCode: text('bank_code').notNull(),
    /** Human bank name at the time of verification, for display (codes mean nothing to a merchant). */
    bankName: text('bank_name').notNull(),
    /** 10-digit NUBAN. */
    accountNumber: text('account_number').notNull(),
    /**
     * 🔒 BANK-CONFIRMED holder name (name enquiry). Not user input. `notNull` is the
     * structural guarantee that an unverified destination cannot be persisted at all.
     */
    accountName: text('account_name').notNull(),
    /** When the bank last confirmed the name above. */
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),

    status: payoutAccountStatusEnum('status').notNull().default('active'),
    isDefault: boolean('is_default').notNull().default(true),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('org_payout_accounts_reference_unique').on(table.reference),
    /**
     * At most ONE default destination per (org, mode) — the sweep resolves exactly one
     * account with no tie-break, so two defaults would make which-bank-gets-the-money
     * a race.
     */
    oneDefaultPerOrg: uniqueIndex('org_payout_accounts_default_unique')
      .on(table.organizationId, table.mode)
      .where(sql`${table.isDefault}`),
    /** The same NUBAN cannot be registered twice for one tenant. */
    accountUnique: uniqueIndex('org_payout_accounts_account_unique').on(
      table.organizationId,
      table.mode,
      table.bankCode,
      table.accountNumber
    ),
    orgIdx: index('org_payout_accounts_org_idx').on(table.organizationId, table.mode),
  })
);

export type PayoutAccountRow = typeof orgPayoutAccountsTable.$inferSelect;
export type PayoutAccountInsert = typeof orgPayoutAccountsTable.$inferInsert;
