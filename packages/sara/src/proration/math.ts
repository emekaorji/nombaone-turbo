import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { Kobo } from '../money';

/**
 * Floor-division proration (J1/C3) — NEVER floating point. `remainingUnits` and
 * `totalUnits` are INTEGER time units of the period (e.g. whole seconds), so the
 * result is `floor(amountKobo · remaining / total)` in exact integer arithmetic.
 * Clamps `remaining` into `[0, total]`.
 */
export function prorate(amountKobo: Kobo, remainingUnits: number, totalUnits: number): Kobo {
  if (!Number.isInteger(totalUnits) || totalUnits <= 0) {
    throw AppError.UnprocessableEntity(
      'proration period must be a positive integer span',
      { totalUnits },
      NOMBAONE_ERROR_CODES.PRORATION_PERIOD_INVALID
    );
  }
  const remaining = Math.min(Math.max(remainingUnits, 0), totalUnits);
  return Math.floor((amountKobo * remaining) / totalUnits);
}

/**
 * Split `total` kobo across parts weighted by `weights`, exactly — the
 * **largest-remainder method** (C3): integer-divide for the base per part, then
 * hand the `total − Σbase` leftover kobo one at a time to the parts with the
 * largest division remainders. Guarantees `Σ result === total` to the kobo,
 * deterministically (ties broken by index). No float, no rounding leak.
 */
export function distributeKobo(total: Kobo, weights: number[]): Kobo[] {
  const n = weights.length;
  if (n === 0) return [];
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) {
    // Degenerate (all-zero weights): distribute equally by the same algorithm.
    return distributeKobo(total, weights.map(() => 1));
  }

  const base = weights.map((w) => Math.floor((total * w) / weightSum));
  const remainders = weights.map((w, i) => ({ i, rem: (total * w) % weightSum }));
  const distributed = base.reduce((s, b) => s + b, 0);
  let leftover = total - distributed; // in [0, n)

  remainders.sort((a, b) => b.rem - a.rem || a.i - b.i);
  const result = [...base];
  for (let k = 0; leftover > 0 && k < n; k += 1, leftover -= 1) {
    const idx = remainders[k]!.i;
    result[idx] = (result[idx] ?? 0) + 1;
  }
  return result;
}

/** Invariant guard (mirrors `ledger/assertBalanced`): Σ parts MUST equal total. */
export function assertDistributionExact(parts: Kobo[], total: Kobo): void {
  const sum = parts.reduce((s, p) => s + p, 0);
  if (sum !== total) {
    throw AppError.UnprocessableEntity(
      'kobo distribution does not sum to the total',
      { sum, total },
      NOMBAONE_ERROR_CODES.PRORATION_DISTRIBUTION_UNBALANCED
    );
  }
}
