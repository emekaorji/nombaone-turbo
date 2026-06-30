import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { couponsTable, type CouponRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * PURE redemption check: throws `COUPON_EXPIRED` past `redeem_by`, or
 * `COUPON_MAX_REDEMPTIONS_REACHED` once `times_redeemed >= max_redemptions`.
 */
export function assertRedeemable(coupon: CouponRow, now: Date): void {
  if (coupon.redeemBy && coupon.redeemBy.getTime() < now.getTime()) {
    throw AppError.UnprocessableEntity(
      'coupon has expired',
      { reference: coupon.reference },
      NOMBAONE_ERROR_CODES.COUPON_EXPIRED
    );
  }
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    throw AppError.UnprocessableEntity(
      'coupon has reached its maximum redemptions',
      { reference: coupon.reference },
      NOMBAONE_ERROR_CODES.COUPON_MAX_REDEMPTIONS_REACHED
    );
  }
}

/**
 * Atomically redeem a coupon — `UPDATE … SET times_redeemed = times_redeemed + 1
 * WHERE id = ? AND (max_redemptions IS NULL OR times_redeemed < max_redemptions)
 * RETURNING`. A zero-row result means the cap was hit by a concurrent redemption,
 * so over-redemption is **structurally impossible** (K2) — no read-modify-write race.
 */
export async function redeemCoupon(
  txDb: InfraTxDb,
  _ctx: DomainContext,
  couponId: string,
  reference: string
): Promise<void> {
  const [updated] = await txDb
    .update(couponsTable)
    .set({ timesRedeemed: sql`${couponsTable.timesRedeemed} + 1` })
    .where(
      and(
        eq(couponsTable.id, couponId),
        or(isNull(couponsTable.maxRedemptions), lt(couponsTable.timesRedeemed, couponsTable.maxRedemptions))
      )
    )
    .returning({ id: couponsTable.id });
  if (!updated) {
    throw AppError.UnprocessableEntity(
      'coupon has reached its maximum redemptions',
      { reference },
      NOMBAONE_ERROR_CODES.COUPON_MAX_REDEMPTIONS_REACHED
    );
  }
}
