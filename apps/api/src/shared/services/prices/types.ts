import type {
  PriceBillingScheme,
  PriceInterval,
  PriceResponseData,
  PriceUsageType,
} from '@nombaone/core-contracts/types';

export type { PriceBillingScheme, PriceInterval, PriceResponseData, PriceUsageType };

/**
 * A price minus its parent binding — the shape a plan create EMBEDS, where the
 * plan is the one being minted in the same call and so has no reference to quote
 * yet. `createPrice` takes this plus the `planRef` that binds it.
 */
export interface EmbeddedPriceInput {
  unitAmount: number;
  interval: PriceInterval;
  intervalCount: number;
  usageType: PriceUsageType;
  billingScheme: PriceBillingScheme;
  trialPeriodDays: number;
  metadata?: Record<string, unknown>;
}

/** Input to `createPrice`. `planRef` is the parent plan's public reference. */
export interface CreatePriceInput extends EmbeddedPriceInput {
  planRef: string;
}

/** Filter / paging options for `listPrices`. */
export interface ListPricesOptions {
  planRef?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
}
