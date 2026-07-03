import { computeClampedFee, DEFAULT_FEE_SCHEDULE } from '../config/fees';
import { getOrgBillingSettings } from '../org';

import type { DomainContext, InfraDb } from '../context';

/**
 * Resolve the platform fee for a gross amount under the tenant's policy (H5): use
 * the per-tenant `platform_fee_bps/min/max` override from `org_billing_settings`
 * when present, else `DEFAULT_FEE_SCHEDULE`. Pure clamp math (`computeClampedFee`) —
 * integer kobo, no float. Extends `resolveFee`'s documented per-org seam.
 */
export async function resolvePlatformFee(
  db: InfraDb,
  ctx: DomainContext,
  grossKobo: number
): Promise<number> {
  const s = await getOrgBillingSettings(db, ctx);
  return computeClampedFee({
    amount: grossKobo,
    rateBps: s.platformFeeBps ?? DEFAULT_FEE_SCHEDULE.rateBps,
    min: s.platformFeeMinKobo ?? DEFAULT_FEE_SCHEDULE.min,
    max: s.platformFeeMaxKobo ?? DEFAULT_FEE_SCHEDULE.max,
  });
}
