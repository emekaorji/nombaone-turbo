import { bigint, boolean, integer, jsonb, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

/** How a tenant's collections settle (08). Split at collection is the default. */
export const orgSettlementModeEnum = pgEnum('org_settlement_mode', [
  'split_at_collection',
  'collect_then_payout',
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
    // ── 08 limits / settlement / branding (additive; still 05's sole CREATE) ────
    rateLimitPerMinute: integer('rate_limit_per_minute'), // null ⇒ platform default (floor)
    monthlyRequestQuota: bigint('monthly_request_quota', { mode: 'number' }), // null ⇒ unlimited
    settlementMode: orgSettlementModeEnum('settlement_mode').notNull().default('split_at_collection'),
    platformFeeBps: integer('platform_fee_bps'), // null ⇒ DEFAULT_FEE_SCHEDULE
    platformFeeMinKobo: bigint('platform_fee_min_kobo', { mode: 'number' }),
    platformFeeMaxKobo: bigint('platform_fee_max_kobo', { mode: 'number' }),
    branding: jsonb('branding')
      .$type<{ displayName?: string; supportEmail?: string; logoUrl?: string; primaryColorHex?: string }>()
      .notNull()
      .default({}),
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
