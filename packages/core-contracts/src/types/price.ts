import type { PriceInterval } from '../billing/interval';
import type { Mode } from './common';

/**
 * PRICE DTO — an immutable, versioned way to charge for a plan. Money is integer
 * kobo; `currency` is always `NGN`. `planId` is the plan's public **reference**
 * (never the internal UUID). `active` is the explicit sellability flag.
 *
 * The cadence unit is declared once, in `../billing/interval` — re-exported here
 * so `@nombaone/core-contracts/types` stays the stable import path for the type.
 */
export type { PriceInterval, CalendarInterval, WallClockInterval } from '../billing/interval';
export type PriceUsageType = 'licensed' | 'metered';
export type PriceBillingScheme = 'per_unit' | 'tiered';

export interface PriceResponseData {
  domain: 'price'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo749201835566prc`
  planId: string; // the plan's public reference (`nbo…pln`)
  unitAmountInKobo: number; // kobo
  currency: 'NGN';
  interval: PriceInterval;
  intervalCount: number;
  usageType: PriceUsageType;
  billingScheme: PriceBillingScheme;
  trialPeriodDays: number;
  active: boolean;
  metadata: Record<string, unknown>;
  mode: Mode;
  createdAt: string;
}
