import type {
  PriceBillingScheme,
  PriceInterval,
  PriceResponseData,
  PriceUsageType,
} from '@nombaone/core-contracts/types';

export type { PriceBillingScheme, PriceInterval, PriceResponseData, PriceUsageType };

/** Input to `createPrice`. `planRef` is the parent plan's public reference. */
export interface CreatePriceInput {
  planRef: string;
  unitAmount: number;
  interval: PriceInterval;
  intervalCount: number;
  usageType: PriceUsageType;
  billingScheme: PriceBillingScheme;
  trialPeriodDays: number;
  metadata?: Record<string, unknown>;
}

/** Filter / paging options for `listPrices`. */
export interface ListPricesOptions {
  planRef?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
}
