import type {
  SubscriptionScheduleResponseData,
  SubscriptionSchedulePhaseData,
  SubscriptionScheduleStatus,
} from '@nombaone/core-contracts/types';

export type {
  SubscriptionScheduleResponseData,
  SubscriptionSchedulePhaseData,
  SubscriptionScheduleStatus,
};

export interface CreateScheduleInput {
  subscriptionRef: string;
  priceRef: string;
  quantity?: number;
  effectiveAt: 'next_cycle';
}
