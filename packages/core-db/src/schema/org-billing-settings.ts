import { boolean, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, updatedAt } from './shared';

export const prorationCreditPolicyEnum = pgEnum('proration_credit_policy', [
  'credit_next_cycle',
  'none',
]);

/**
 * Per-tenant billing settings — **05 is the SOLE creator**; 06 (dunning) and 08
 * (settlement) extend this table with additive `ALTER ADD COLUMN` only, never a
 * second CREATE. Exactly one settings row per (organization, environment).
 */
export const orgBillingSettingsTable = pgTable(
  'org_billing_settings',
  {
    id: idPk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    // Off by default: a short collection is all-or-nothing (→ past_due) unless on.
    partialCollectionEnabled: boolean('partial_collection_enabled').notNull().default(false),
    prorationCreditPolicy: prorationCreditPolicyEnum('proration_credit_policy')
      .notNull()
      .default('credit_next_cycle'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    orgEnvUnique: uniqueIndex('org_billing_settings_org_env_unique').on(
      table.organizationId,
      table.environment
    ),
  })
);

export type OrgBillingSettingsRow = typeof orgBillingSettingsTable.$inferSelect;
export type OrgBillingSettingsInsert = typeof orgBillingSettingsTable.$inferInsert;
