import { addIntervalFromAnchor, type PriceInterval } from './interval';
import { billingDateParts, billingInstant } from './timezone';

export interface PeriodPrice {
  interval: PriceInterval;
  intervalCount: number;
}

export interface PeriodBounds {
  start: Date;
  end: Date;
}

/**
 * The billing anchor: the activation instant normalized to the billing hour on its
 * billing-zone date (B2). Every boundary is `anchor + n·interval`, never "+30 days".
 */
export function computeAnchor(activationInstant: Date): Date {
  return billingInstant(billingDateParts(activationInstant));
}

/**
 * Period `periodIndex`'s half-open `[start, end)` as UTC instants at the billing
 * hour. Both ends are computed directly from the anchor (× `intervalCount`), so EOM
 * snap-back and leap handling are non-destructive (B2/B3/B4).
 */
export function periodBounds(anchor: Date, price: PeriodPrice, periodIndex: number): PeriodBounds {
  const anchorParts = billingDateParts(anchor);
  const startParts = addIntervalFromAnchor(anchorParts, price.interval, periodIndex * price.intervalCount);
  const endParts = addIntervalFromAnchor(anchorParts, price.interval, (periodIndex + 1) * price.intervalCount);
  return { start: billingInstant(startParts), end: billingInstant(endParts) };
}
