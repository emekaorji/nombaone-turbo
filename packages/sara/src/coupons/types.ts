import type { CouponDuration, CouponResponseData } from '@nombaone/core-contracts/types';

export type { CouponDuration, CouponResponseData };

export interface CreateCouponInput {
  code: string;
  amountOff?: number;
  percentOff?: number;
  duration: CouponDuration;
  durationInCycles?: number;
  redeemBy?: Date;
  maxRedemptions?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCouponInput {
  redeemBy?: Date;
  maxRedemptions?: number;
  metadata?: Record<string, unknown>;
}

export interface ListCouponsOptions {
  limit?: number;
  cursor?: string;
}
