import type { SubscriptionRow } from '@nombaone/core-db/schema';
import type { SubscriptionItemData, SubscriptionResponseData } from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export interface SubscriptionSerializeRefs {
  customerRef: string;
  priceRef: string;
  defaultPaymentMethodRef: string | null;
}

/**
 * Bridge a `subscriptions` row to the public DTO. All ids are public references
 * (resolved by the caller via joins); money is kobo; timestamps ISO-8601 UTC.
 * `status` is the FSM lifecycle state.
 */
export const serializeSubscription = (
  row: SubscriptionRow,
  refs: SubscriptionSerializeRefs,
  items: SubscriptionItemData[],
  latestInvoiceId: string | null
): SubscriptionResponseData => ({
  id: row.reference,
  customerId: refs.customerRef,
  priceId: refs.priceRef,
  status: row.status,
  collectionMethod: row.collectionMethod,
  currentPeriodIndex: row.currentPeriodIndex,
  currentPeriodStart: iso(row.currentPeriodStart),
  currentPeriodEnd: iso(row.currentPeriodEnd),
  trialStart: iso(row.trialStart),
  trialEnd: iso(row.trialEnd),
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  canceledAt: iso(row.canceledAt),
  endedAt: iso(row.endedAt),
  cancellationReason: row.cancellationReason,
  defaultPaymentMethodId: refs.defaultPaymentMethodRef,
  items,
  latestInvoiceId,
  currency: 'NGN',
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
