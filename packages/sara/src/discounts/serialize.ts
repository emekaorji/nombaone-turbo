import type { DiscountRow } from '@nombaone/core-db/schema';
import type { DiscountResponseData } from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export interface DiscountSerializeRefs {
  couponRef: string;
  customerRef: string | null;
  subscriptionRef: string | null;
}

export const serializeDiscount = (
  row: DiscountRow,
  refs: DiscountSerializeRefs
): DiscountResponseData => ({
  id: row.reference,
  couponId: refs.couponRef,
  customerId: refs.customerRef,
  subscriptionId: refs.subscriptionRef,
  status: row.status,
  cyclesRemaining: row.cyclesRemaining,
  startAt: new Date(row.startAt).toISOString(),
  endAt: iso(row.endAt),
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
