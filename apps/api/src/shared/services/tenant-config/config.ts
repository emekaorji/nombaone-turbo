import { and, desc, eq } from 'drizzle-orm';

import { webhookEndpointsTable } from '@nombaone/core-db/schema';
import { getOrgBillingSettings, upsertOrgBillingSettings } from '@nombaone/sara/org';

import { resolveTenantAccountRef } from '../settlement';

import type { DomainContext, InfraDb, InfraTxDb } from '@nombaone/sara/context';
import type { TenantSettingsResponseData } from '@nombaone/core-contracts/types';
import type { UpdateTenantSettingsBody } from '@nombaone/core-contracts/validations';


/**
 * The unified tenant-config read (H4): billing settings (05/06/08) + the tenant's
 * webhook endpoint (07 — URL + secret PREFIX only, plaintext never returned) + the
 * Nomba sub-account (08). One place a tenant sees "all my configuration".
 */
export async function getTenantSettings(
  db: InfraDb,
  ctx: DomainContext
): Promise<TenantSettingsResponseData> {
  const s = await getOrgBillingSettings(db, ctx);

  const [endpoint] = await db
    .select()
    .from(webhookEndpointsTable)
    .where(
      and(
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    )
    .orderBy(desc(webhookEndpointsTable.createdAt))
    .limit(1);

  const accountRef = await resolveTenantAccountRef(db, ctx);

  return {
    domain: 'organization',
    billing: {
      rateLimitPerMinute: s.rateLimitPerMinute,
      monthlyRequestQuota: s.monthlyRequestQuota,
      settlementMode: s.settlementMode,
      platformFee: { bps: s.platformFeeBps, minInKobo: s.platformFeeMinKobo, maxInKobo: s.platformFeeMaxKobo },
      grace: { gracePeriodHours: s.gracePeriodHours, dunningMaxAttempts: s.dunningMaxAttempts },
      branding: s.branding,
    },
    webhook: {
      url: endpoint?.url ?? null,
      signingSecretPrefix: endpoint?.signingSecretPrefix ?? null,
      configured: endpoint != null && !endpoint.disabledAt,
    },
    settlement: { accountRef },
  };
}

/**
 * Partial tenant-settings update (H4/H6). Only tenant-editable fields
 * (quota/settlement-mode/branding) — the body cannot carry `rate_limit_per_minute`,
 * so a tenant structurally cannot self-raise its own limit (only an operator seam
 * writes that column directly).
 */
export async function updateTenantSettings(
  db: InfraTxDb,
  ctx: DomainContext,
  input: UpdateTenantSettingsBody
): Promise<TenantSettingsResponseData> {
  await upsertOrgBillingSettings(db, ctx, {
    ...(input.monthlyRequestQuota != null ? { monthlyRequestQuota: input.monthlyRequestQuota } : {}),
    ...(input.settlementMode != null ? { settlementMode: input.settlementMode } : {}),
    ...(input.branding != null ? { branding: input.branding } : {}),
  });
  return getTenantSettings(db, ctx);
}
