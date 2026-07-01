import { and, eq } from 'drizzle-orm';

import { orgBillingSettingsTable } from '@nombaone/core-db/schema';

import type { DomainContext, InfraTxDb } from '../context';

export type ProrationCreditPolicy = 'credit_next_cycle' | 'none';

export interface EffectiveBillingSettings {
  partialCollectionEnabled: boolean;
  prorationCreditPolicy: ProrationCreditPolicy;
}

/**
 * The documented defaults for a tenant that never provisioned a settings row:
 * partial collection OFF (short collection is all-or-nothing) + downgrade credit
 * banked toward the next cycle. 05 is the SOLE creator of `org_billing_settings`.
 */
export const DEFAULT_BILLING_SETTINGS: EffectiveBillingSettings = {
  partialCollectionEnabled: false,
  prorationCreditPolicy: 'credit_next_cycle',
};

/**
 * Read a tenant's effective billing settings, falling back to
 * `DEFAULT_BILLING_SETTINGS` when no row exists. O(1) on the `(org, env)` unique
 * index. Used by the collect path (partial-collection policy) and the proration
 * path (downgrade credit policy).
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
  if (!row) return DEFAULT_BILLING_SETTINGS;
  return {
    partialCollectionEnabled: row.partialCollectionEnabled,
    prorationCreditPolicy: row.prorationCreditPolicy,
  };
}

/**
 * Upsert a tenant's billing settings — idempotent on the `(org, env)` unique
 * index. Only supplied fields are changed. There is one settings row per
 * tenant/env; a first write creates it, later writes patch it.
 */
export async function upsertOrgBillingSettings(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: Partial<EffectiveBillingSettings>
): Promise<EffectiveBillingSettings> {
  const patch = {
    ...(input.partialCollectionEnabled != null
      ? { partialCollectionEnabled: input.partialCollectionEnabled }
      : {}),
    ...(input.prorationCreditPolicy != null
      ? { prorationCreditPolicy: input.prorationCreditPolicy }
      : {}),
  };
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
  // An insert-or-update always returns exactly one row.
  if (!row) return { ...DEFAULT_BILLING_SETTINGS, ...input };
  return {
    partialCollectionEnabled: row.partialCollectionEnabled,
    prorationCreditPolicy: row.prorationCreditPolicy,
  };
}
