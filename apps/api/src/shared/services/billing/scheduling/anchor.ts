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
 * Like `computeAnchor`, but never returns an instant BEFORE `instant` — if the
 * billing hour has already passed on `instant`'s date, it rolls to the next day's
 * billing hour. Used for the TRIAL anchor so normalizing the trial end to the
 * billing hour can never pull the first charge into the trial window (A8).
 */
export function computeAnchorAtOrAfter(instant: Date): Date {
  const at = computeAnchor(instant);
  if (at.getTime() >= instant.getTime()) return at;
  const parts = billingDateParts(instant);
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return billingInstant(billingDateParts(nextDay));
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

export interface IntervalSwitchReanchor {
  anchor: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingAt: Date;
}

/**
 * Re-anchor a subscription onto a NEW cadence at an interval switch (C4). The fresh
 * new-cadence period is `[changeAt, changeAt+newInterval]`; future renewals continue
 * on the new cadence. To keep the invoice `unique(subscription_id, period_index)`
 * constraint collision-free, `current_period_index` is UNCHANGED (it is still the
 * next-to-bill, monotonically increasing, fresh index) — instead the new anchor is
 * BACK-DATED by `currentPeriodIndex` new-cadence periods so that
 * `periodBounds(anchor, newPrice, currentPeriodIndex).start == changeAt + newInterval`
 * (the next renewal boundary). All returned instants are DERIVED from the new anchor,
 * so runCycle's anchor-based math stays internally consistent (no drift, EOM/leap safe).
 */
export function reanchorForIntervalSwitch(
  changeAt: Date,
  currentPeriodIndex: number,
  newPrice: PeriodPrice
): IntervalSwitchReanchor {
  const changeAtParts = billingDateParts(changeAt);
  // One new-interval after changeAt (the next renewal boundary).
  const nextBoundaryParts = addIntervalFromAnchor(changeAtParts, newPrice.interval, newPrice.intervalCount);
  // Anchor back-dated so index `currentPeriodIndex` lands on that next boundary.
  const anchorParts = addIntervalFromAnchor(
    nextBoundaryParts,
    newPrice.interval,
    -(currentPeriodIndex * newPrice.intervalCount)
  );
  const anchor = billingInstant(anchorParts);
  const nextBillingAt = periodBounds(anchor, newPrice, currentPeriodIndex).start;
  return {
    anchor,
    currentPeriodStart: billingInstant(changeAtParts), // fresh period start ≈ changeAt
    currentPeriodEnd: nextBillingAt, // fresh period end = next boundary (derived)
    nextBillingAt,
  };
}
