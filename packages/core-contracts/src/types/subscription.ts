import type { Mode } from './common';

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled';
export type CollectionMethod = 'charge_automatically' | 'send_invoice';
export type CancellationReason = 'voluntary' | 'involuntary';

export interface SubscriptionItemData {
  id: string; // item reference
  priceId: string; // the price's public reference
  quantity: number;
}

/**
 * SUBSCRIPTION DTO. `status` is the FSM lifecycle state (kept consistent with the
 * ledger). `id`/refs are public references, never UUIDs. Money fields are kobo.
 */
export interface SubscriptionResponseData {
  domain: 'subscription'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo…sub`
  customerId: string;
  priceId: string;
  status: SubscriptionStatus;
  collectionMethod: CollectionMethod;
  currentPeriodIndex: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  cancellationReason: CancellationReason | null;
  defaultPaymentMethodId: string | null;
  items: SubscriptionItemData[];
  latestInvoiceId: string | null;
  currency: 'NGN';
  mode: Mode;
  createdAt: string;
}
