import type { DunningBranch } from '@nombaone/core-contracts/types';
import type { EffectiveBillingSettings } from '../org/billing-settings';

/** The tenant's resolved dunning policy is exactly the effective billing settings. */
export type ResolvedDunningPolicy = EffectiveBillingSettings;

export type { DunningBranch };
