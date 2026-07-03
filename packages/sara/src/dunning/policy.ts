import { DEFAULT_BILLING_SETTINGS, getOrgBillingSettings } from '../org/billing-settings';

import type { DomainContext, InfraTxDb } from '../context';
import type { ResolvedDunningPolicy } from './types';

/**
 * The hard-coded platform default (the `org_billing_settings` column defaults). A
 * tenant that never configured dunning still dunns by this. **D2.**
 */
export const PLATFORM_DEFAULT_DUNNING_POLICY: ResolvedDunningPolicy = DEFAULT_BILLING_SETTINGS;

/**
 * Resolve the tenant's dunning policy for `(org, env)`, falling back to the
 * platform default when no settings row exists. One read on the `(org, env)` unique
 * index. **D2.**
 */
export async function resolveBillingSettings(
  db: InfraTxDb,
  ctx: DomainContext
): Promise<ResolvedDunningPolicy> {
  return getOrgBillingSettings(db, ctx);
}
