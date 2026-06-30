import { daysInMonth } from './leap';

import type { PriceInterval } from '@nombaone/core-contracts/types';
import type { DateParts } from './timezone';

export type { PriceInterval };

/**
 * Add `k` units to a billing-zone DATE, computed FROM THE ANCHOR so end-of-month
 * snap-back is non-destructive (B3/B4). For `month`/`year`, the target day is
 * `min(anchorDayOfMonth, daysInTargetMonth)` — so a Jan-31 anchor gives Feb-28 at
 * k=1 but **Mar-31** at k=2 (the anchor's 31 is preserved, never the clamped 28).
 * For `day`/`week`, it is exact additive arithmetic (leap-crossing by construction).
 *
 * Callers pass `anchorParts` (the anchor's billing-zone date) and `k` = the number
 * of units past the anchor; this is NOT iterative, so no step can corrupt the DOM.
 */
export function addIntervalFromAnchor(
  anchorParts: DateParts,
  unit: PriceInterval,
  k: number
): DateParts {
  if (unit === 'day' || unit === 'week') {
    const days = (unit === 'week' ? 7 : 1) * k;
    const d = new Date(Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day + days));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  // month / year: jump months directly from the anchor, clamp DOM to the target.
  const monthsToAdd = (unit === 'year' ? 12 : 1) * k;
  const zeroBased = anchorParts.month - 1 + monthsToAdd;
  const year = anchorParts.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  const day = Math.min(anchorParts.day, daysInMonth(year, month));
  return { year, month, day };
}
