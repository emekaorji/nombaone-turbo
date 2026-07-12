import { isWallClockInterval, wallClockStepMs } from '@nombaone/core-contracts/billing';

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
 * The billing anchor.
 *
 * CALENDAR cadences: the activation instant normalized to the billing hour on its
 * billing-zone date (B2). Every boundary is then `anchor + n·interval`, never
 * "+30 days".
 *
 * WALL-CLOCK cadences: the activation instant ITSELF, unnormalized. Snapping it to
 * the billing hour would be actively wrong — a 10-minute subscription started at
 * 14:37 must bill at 14:47, not at the next 02:00. (Returning the instant exactly,
 * rather than truncating it, is what lets `computeAnchorAtOrAfter` stay correct
 * without a second branch: the anchor is never earlier than the instant.)
 */
export function computeAnchor(activationInstant: Date, interval: PriceInterval): Date {
  if (isWallClockInterval(interval)) return new Date(activationInstant.getTime());
  return billingInstant(billingDateParts(activationInstant));
}

/**
 * Like `computeAnchor`, but never returns an instant BEFORE `instant` — if the
 * billing hour has already passed on `instant`'s date, it rolls to the next day's
 * billing hour. Used for the TRIAL anchor so normalizing the trial end to the
 * billing hour can never pull the first charge into the trial window (A8).
 *
 * A wall-clock anchor IS the instant, so the guard below returns it untouched.
 */
export function computeAnchorAtOrAfter(instant: Date, interval: PriceInterval): Date {
  const at = computeAnchor(instant, interval);
  if (at.getTime() >= instant.getTime()) return at;
  const parts = billingDateParts(instant);
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return billingInstant(billingDateParts(nextDay));
}

/**
 * Period `periodIndex`'s half-open `[start, end)`.
 *
 * CALENDAR cadences: UTC instants at the billing hour, both ends computed directly
 * from the anchor (× `intervalCount`), so EOM snap-back and leap handling are
 * non-destructive (B2/B3/B4).
 *
 * WALL-CLOCK cadences: exact millisecond offsets from the anchor instant. Also
 * computed FROM THE ANCHOR rather than iteratively, so no drift accumulates over a
 * long run of short periods.
 */
export function periodBounds(anchor: Date, price: PeriodPrice, periodIndex: number): PeriodBounds {
  if (isWallClockInterval(price.interval)) {
    const stepMs = wallClockStepMs(price.interval) * price.intervalCount;
    return {
      start: new Date(anchor.getTime() + periodIndex * stepMs),
      end: new Date(anchor.getTime() + (periodIndex + 1) * stepMs),
    };
  }

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
 *
 * Both branches below are the same three steps — next boundary, back-dated anchor,
 * derived bounds — expressed in the arithmetic each cadence family understands.
 */
export function reanchorForIntervalSwitch(
  changeAt: Date,
  currentPeriodIndex: number,
  newPrice: PeriodPrice
): IntervalSwitchReanchor {
  if (isWallClockInterval(newPrice.interval)) {
    const stepMs = wallClockStepMs(newPrice.interval) * newPrice.intervalCount;
    const nextBillingAt = new Date(changeAt.getTime() + stepMs);
    const anchor = new Date(nextBillingAt.getTime() - currentPeriodIndex * stepMs);
    return {
      anchor,
      currentPeriodStart: new Date(changeAt.getTime()),
      currentPeriodEnd: nextBillingAt,
      nextBillingAt,
    };
  }

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
