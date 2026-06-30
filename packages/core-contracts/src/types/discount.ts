import type { Environment } from './common';

export type DiscountStatus = 'active' | 'ended';

export interface DiscountResponseData {
  id: string; // public reference, e.g. `nbo…dsc`
  couponId: string; // coupon reference
  customerId: string | null;
  subscriptionId: string | null;
  status: DiscountStatus;
  cyclesRemaining: number | null;
  startAt: string;
  endAt: string | null;
  environment: Environment;
  createdAt: string;
}
