import type { CouponRow } from '@nombaone/core-db/schema';
import type { CouponResponseData } from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export const serializeCoupon = (row: CouponRow): CouponResponseData => ({
  id: row.reference,
  code: row.code,
  duration: row.duration,
  amountOff: row.amountOff,
  percentOff: row.percentOff,
  durationInCycles: row.durationInCycles,
  redeemBy: iso(row.redeemBy),
  maxRedemptions: row.maxRedemptions,
  timesRedeemed: row.timesRedeemed,
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
