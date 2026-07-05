import type { Kobo } from '@nombaone/sara/money';

export type PartialCollectionStatus = 'paid' | 'partially_paid' | 'open';

export interface PartialCollectionResult {
  status: PartialCollectionStatus;
  amountRemaining: Kobo;
}

/**
 * Pure policy for a short rail collection. Full payment → `paid`. A short payment
 * with partial collection ENABLED → `partially_paid` tracking the remainder (06
 * dunning pursues it). With it DISABLED (the default) → all-or-nothing: the invoice
 * stays `open` and the subscription goes `past_due` — unchanged from 03.
 */
export function resolvePartialCollection(
  enabled: boolean,
  amountDue: Kobo,
  collected: Kobo
): PartialCollectionResult {
  if (collected >= amountDue) return { status: 'paid', amountRemaining: 0 };
  if (!enabled) return { status: 'open', amountRemaining: amountDue };
  return { status: 'partially_paid', amountRemaining: amountDue - collected };
}
