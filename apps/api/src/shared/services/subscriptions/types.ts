import type {
  CancellationReason,
  CollectionMethod,
  SubscriptionItemData,
  SubscriptionResponseData,
  SubscriptionStatus,
} from '@nombaone/core-contracts/types';

export type {
  CancellationReason,
  CollectionMethod,
  SubscriptionItemData,
  SubscriptionResponseData,
  SubscriptionStatus,
};

export interface CreateSubscriptionInput {
  customerRef: string;
  priceRef: string;
  paymentMethodRef?: string;
  collectionMethod: CollectionMethod;
  trialDays?: number;
  quantity: number;
  /** Hosted-checkout entry only: where the Nomba page returns the payer. */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ResubscribeInput {
  priceRef?: string;
  paymentMethodRef?: string;
}

export interface ListSubscriptionsOptions {
  customerRef?: string;
  status?: SubscriptionStatus;
  limit?: number;
  cursor?: string;
}
