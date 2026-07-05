import { describe, expect, it } from 'vitest';

import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertRedeemable } from '@shared/services/coupons';
import { computeDiscountLine } from '@shared/services/discounts';

import type { CouponRow } from '@nombaone/core-db/schema';

const coupon = (over: Partial<CouponRow>): CouponRow =>
  ({
    reference: 'nbo000cpn',
    redeemBy: null,
    maxRedemptions: null,
    timesRedeemed: 0,
    ...over,
  }) as CouponRow;

const codeOf = (fn: () => void): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe('coupons/assertRedeemable', () => {
  it('passes a valid coupon', () => {
    expect(() => assertRedeemable(coupon({}), new Date())).not.toThrow();
  });
  it('throws COUPON_EXPIRED past redeem_by', () => {
    expect(codeOf(() => assertRedeemable(coupon({ redeemBy: new Date('2020-01-01') }), new Date()))).toBe(
      NOMBAONE_ERROR_CODES.COUPON_EXPIRED
    );
  });
  it('throws COUPON_MAX_REDEMPTIONS_REACHED at the cap', () => {
    expect(codeOf(() => assertRedeemable(coupon({ maxRedemptions: 5, timesRedeemed: 5 }), new Date()))).toBe(
      NOMBAONE_ERROR_CODES.COUPON_MAX_REDEMPTIONS_REACHED
    );
  });
});

describe('discounts/computeDiscountLine — clamped negative line (J/L)', () => {
  it('percent_off floors', () => {
    expect(computeDiscountLine(1_000_000, { amountOff: null, percentOff: 25 }, 'd')?.amount).toBe(-250_000);
  });
  it('amount_off', () => {
    expect(computeDiscountLine(1_000_000, { amountOff: 300_000, percentOff: null }, 'd')?.amount).toBe(-300_000);
  });
  it('clamps amount_off to the subtotal (never exceeds → no negative invoice)', () => {
    expect(computeDiscountLine(200_000, { amountOff: 500_000, percentOff: null }, 'd')?.amount).toBe(-200_000);
  });
  it('100%-off → the discount line equals the subtotal', () => {
    expect(computeDiscountLine(1_000_000, { amountOff: null, percentOff: 100 }, 'd')?.amount).toBe(-1_000_000);
  });
  it('zero subtotal → no line', () => {
    expect(computeDiscountLine(0, { amountOff: null, percentOff: 50 }, 'd')).toBeNull();
  });
});
