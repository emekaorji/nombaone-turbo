import type { Environment } from './common';

export type CouponDuration = 'once' | 'repeating' | 'forever';

export interface CouponResponseData {
  domain: 'coupon'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo…cpn`
  code: string;
  duration: CouponDuration;
  amountOffInKobo: number | null; // kobo
  percentOff: number | null;
  durationInCycles: number | null;
  redeemBy: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  environment: Environment;
  createdAt: string;
}
