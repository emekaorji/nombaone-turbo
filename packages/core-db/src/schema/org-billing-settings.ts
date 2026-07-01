import { boolean, integer, jsonb, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, updatedAt } from './shared';

export const prorationCreditPolicyEnum = pgEnum('proration_credit_policy', [
  'credit_next_cycle',
  'none',
]);

/** Default rail behaviour when a subscription does not pin its own collection method. */
export const defaultCollectionMethodEnum = pgEnum('default_collection_method', [
  'charge_automatically',
  'send_invoice',
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
    // ── 06 dunning policy (additive; the table stays 05's sole CREATE) ──────────
    dunningMaxAttempts: integer('dunning_max_attempts').notNull().default(4),
    dunningIntervalsHours: jsonb('dunning_intervals_hours')
      .$type<number[]>()
      .notNull()
      .default([24, 72, 120, 168]),
    dunningMaxWindowHours: integer('dunning_max_window_hours').notNull().default(336),
    gracePeriodHours: integer('grace_period_hours').notNull().default(72),
    paydayDays: jsonb('payday_days').$type<number[]>().notNull().default([26, 27, 28, 29, 30, 1]),
    paydayPullForwardDays: integer('payday_pull_forward_days').notNull().default(4),
    paydayBiasEnabled: boolean('payday_bias_enabled').notNull().default(true),
    defaultCollectionMethod: defaultCollectionMethodEnum('default_collection_method')
      .notNull()
      .default('charge_automatically'),
    commsEnabled: boolean('comms_enabled').notNull().default(true),
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
