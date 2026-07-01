import { and, eq } from 'drizzle-orm';

import { orgBillingSettingsTable, type OrgBillingSettingsRow } from '@nombaone/core-db/schema';

import type { BillingSettingsResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '../context';

export type ProrationCreditPolicy = 'credit_next_cycle' | 'none';
export type DefaultCollectionMethod = 'charge_automatically' | 'send_invoice';

/**
 * A tenant's FULL effective billing + dunning policy. The collect path reads
 * `partialCollectionEnabled`; the dunning engine (06) reads the rest. One reader,
 * one source of truth — 05 created the table, 06 extended it additively.
 */
export interface EffectiveBillingSettings {
  partialCollectionEnabled: boolean;
  prorationCreditPolicy: ProrationCreditPolicy;
  dunningMaxAttempts: number;
  dunningIntervalsHours: number[];
  dunningMaxWindowHours: number;
  gracePeriodHours: number;
  paydayDays: number[];
  paydayPullForwardDays: number;
  paydayBiasEnabled: boolean;
  defaultCollectionMethod: DefaultCollectionMethod;
  commsEnabled: boolean;
}

/**
 * The hard-coded platform default, mirroring the `org_billing_settings` column
 * defaults — the policy a tenant that never configured settings still dunns by.
 */
export const DEFAULT_BILLING_SETTINGS: EffectiveBillingSettings = {
  partialCollectionEnabled: false,
  prorationCreditPolicy: 'credit_next_cycle',
  dunningMaxAttempts: 4,
  dunningIntervalsHours: [24, 72, 120, 168],
  dunningMaxWindowHours: 336,
  gracePeriodHours: 72,
  paydayDays: [26, 27, 28, 29, 30, 1],
  paydayPullForwardDays: 4,
  paydayBiasEnabled: true,
  defaultCollectionMethod: 'charge_automatically',
  commsEnabled: true,
};

const fromRow = (row: OrgBillingSettingsRow): EffectiveBillingSettings => ({
  partialCollectionEnabled: row.partialCollectionEnabled,
  prorationCreditPolicy: row.prorationCreditPolicy,
  dunningMaxAttempts: row.dunningMaxAttempts,
  dunningIntervalsHours: row.dunningIntervalsHours,
  dunningMaxWindowHours: row.dunningMaxWindowHours,
  gracePeriodHours: row.gracePeriodHours,
  paydayDays: row.paydayDays,
  paydayPullForwardDays: row.paydayPullForwardDays,
  paydayBiasEnabled: row.paydayBiasEnabled,
  defaultCollectionMethod: row.defaultCollectionMethod,
  commsEnabled: row.commsEnabled,
});

/**
 * Read a tenant's effective billing settings, falling back to
 * `DEFAULT_BILLING_SETTINGS` when no row exists. O(1) on the `(org, env)` unique
 * index.
 */
export async function getOrgBillingSettings(
  txDb: InfraTxDb,
  ctx: DomainContext
): Promise<EffectiveBillingSettings> {
  const [row] = await txDb
    .select()
    .from(orgBillingSettingsTable)
    .where(
      and(
        eq(orgBillingSettingsTable.organizationId, ctx.organizationId),
        eq(orgBillingSettingsTable.environment, ctx.environment)
      )
    )
    .limit(1);
  return row ? fromRow(row) : DEFAULT_BILLING_SETTINGS;
}

/**
 * Upsert a tenant's billing settings — idempotent on the `(org, env)` unique
 * index. Only supplied fields are changed. One settings row per tenant/env.
 */
export async function upsertOrgBillingSettings(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: Partial<EffectiveBillingSettings>
): Promise<EffectiveBillingSettings> {
  // Drop undefined keys so a patch never overwrites with undefined.
  const patch = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  ) as Partial<EffectiveBillingSettings>;
  const [row] = await txDb
    .insert(orgBillingSettingsTable)
    .values({
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      ...patch,
    })
    .onConflictDoUpdate({
      target: [orgBillingSettingsTable.organizationId, orgBillingSettingsTable.environment],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row ? fromRow(row) : { ...DEFAULT_BILLING_SETTINGS, ...patch };
}

/** Serialize settings to the public DTO (already camelCased 1:1). */
export const serializeBillingSettings = (
  settings: EffectiveBillingSettings
): BillingSettingsResponseData => ({ ...settings });
