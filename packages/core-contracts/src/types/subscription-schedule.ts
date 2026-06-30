import type { Environment } from './common';

export type SubscriptionScheduleStatus = 'active' | 'released' | 'canceled';

export interface SubscriptionSchedulePhaseData {
  /** The period index at which this phase takes effect (the boundary). */
  startIndex: number;
  priceId: string; // public price reference
  quantity?: number;
  consumedAt: string | null; // set when the sweep applies the phase at the boundary
}

/**
 * A subscription schedule (contract C.1): an ordered list of future-dated phases
 * applied at the next cycle boundary by the sweep (B10), not at API-call time.
 */
export interface SubscriptionScheduleResponseData {
  id: string; // public reference, e.g. `nbo…sch`
  subscriptionId: string;
  status: SubscriptionScheduleStatus;
  phases: SubscriptionSchedulePhaseData[];
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}
