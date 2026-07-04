import { pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol, updatedAt } from './shared';
import { organizationsTable } from './organizations';

/**
 * Maps a tenant (org) to its Nomba account(s) — the parent account and, for
 * settlement, a per-tenant sub-account. THIS PHASE is mapping only: it records the
 * Nomba-side id and our stable `account_ref`. Phase 08 extends this row with
 * balance / split / settlement columns. One row per (org, mode, kind).
 */
export const orgNombaAccountKindEnum = pgEnum('org_nomba_account_kind', ['parent', 'subaccount']);

/** Sub-account lifecycle (08 settlement) — a settlement needs an `active` sub-account. */
export const nombaAccountStatusEnum = pgEnum('nomba_account_status', [
  'pending',
  'active',
  'suspended',
]);

export const orgNombaAccountsTable = pgTable(
  'org_nomba_accounts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    nombaAccountId: text('nomba_account_id').notNull(),
    accountRef: text('account_ref').notNull(),
    kind: orgNombaAccountKindEnum('kind').notNull(),
    // 08: the Nomba-side sub-account id (foreign ref only) + sub-account status.
    subAccountId: text('sub_account_id'),
    status: nombaAccountStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('org_nomba_accounts_reference_unique').on(table.reference),
    orgEnvKindUnique: uniqueIndex('org_nomba_accounts_org_env_kind_unique').on(
      table.organizationId,
      table.mode,
      table.kind
    ),
  })
);

export type OrgNombaAccountRow = typeof orgNombaAccountsTable.$inferSelect;
export type OrgNombaAccountInsert = typeof orgNombaAccountsTable.$inferInsert;
