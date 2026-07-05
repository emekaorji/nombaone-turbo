import { getOrgBillingSettings } from '@nombaone/sara/org';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

/** The platform per-minute rate-limit floor (mirrors the limiter's WINDOW_LIMIT). */
export const PLATFORM_RATE_LIMIT = 120;

/**
 * Resolve a tenant's effective per-minute cap (H6): the platform default is the
 * FLOOR; an operator-set override may only RAISE it (an override below the floor is
 * clamped up). The tenant API cannot set this field (see `updateTenantSettings`).
 */
export async function resolveRateLimit(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<{ perMinute: number }> {
  const s = await getOrgBillingSettings(db, ctx);
  const perMinute =
    s.rateLimitPerMinute != null
      ? Math.max(s.rateLimitPerMinute, PLATFORM_RATE_LIMIT)
      : PLATFORM_RATE_LIMIT;
  return { perMinute };
}

/** Resolve a tenant's coarse monthly request quota (null ⇒ unlimited). H6. */
export async function resolveQuota(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<{ monthly: number | null }> {
  const s = await getOrgBillingSettings(db, ctx);
  return { monthly: s.monthlyRequestQuota };
}
