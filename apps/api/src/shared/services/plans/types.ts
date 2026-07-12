import type {
  PlanResponseData,
  PlanStatus,
  PlanWithPricesResponseData,
} from '@nombaone/core-contracts/types';
import type { EmbeddedPriceInput } from '../prices/types';

export type { PlanResponseData, PlanStatus, PlanWithPricesResponseData };

/** Input to `createPlan`. */
export interface CreatePlanInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Input to `createPlanWithPrices`: a plan plus the prices it launches with, all
 *  written in one transaction. `prices` is non-empty — the boundary rejects `[]`. */
export interface CreatePlanWithPricesInput extends CreatePlanInput {
  prices: EmbeddedPriceInput[];
}

/** Partial input to `updatePlan` (status is changed only via `archivePlan`). */
export interface UpdatePlanInput {
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

/** Filter / paging options for `listPlans`. */
export interface ListPlansOptions {
  status?: PlanStatus;
  limit?: number;
  cursor?: string;
}
