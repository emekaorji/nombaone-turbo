import type { Mode } from './common';

export type DiscountStatus = 'active' | 'ended';

export interface DiscountResponseData {
  domain: 'discount'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo…dsc`
  couponId: string; // coupon reference
  customerId: string | null;
  subscriptionId: string | null;
  status: DiscountStatus;
  cyclesRemaining: number | null;
  startAt: string;
  endAt: string | null;
  mode: Mode;
  createdAt: string;
}
