import type { PlanResponseData, PlanStatus } from '@nombaone/core-contracts/types';

export type { PlanResponseData, PlanStatus };

/** Input to `createPlan`. */
export interface CreatePlanInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
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
