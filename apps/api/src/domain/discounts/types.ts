import type { DiscountResponseData, DiscountStatus } from '@nombaone/core-contracts/types';

export type { DiscountResponseData, DiscountStatus };

export interface ApplyDiscountInput {
  couponRefOrCode: string;
  customerRef?: string;
  subscriptionRef?: string;
}

export interface RemoveDiscountTarget {
  customerRef?: string;
  subscriptionRef?: string;
}
