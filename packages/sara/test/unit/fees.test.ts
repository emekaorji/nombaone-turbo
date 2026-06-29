import { describe, expect, it } from 'vitest';

import { computeClampedFee } from '@nombaone/sara/config';

/**
 * Pure fee math: round(amount × rateBps / 10000) clamped into [min, max].
 */
describe('config.computeClampedFee', () => {
  it('applies the rate when the result lands inside the band', () => {
    // 100,000 kobo × 150 bps = 1,500 kobo, within [1,000, 200,000].
    expect(computeClampedFee({ amount: 100_000, rateBps: 150, min: 1_000, max: 200_000 })).toBe(
      1_500
    );
  });

  it('clamps up to the minimum floor', () => {
    // 1,000 kobo × 150 bps = 15 kobo, below the 1,000 floor.
    expect(computeClampedFee({ amount: 1_000, rateBps: 150, min: 1_000, max: 200_000 })).toBe(
      1_000
    );
  });

  it('clamps down to the maximum ceiling', () => {
    // 100,000,000 kobo × 150 bps = 1,500,000 kobo, above the 200,000 ceiling.
    expect(
      computeClampedFee({ amount: 100_000_000, rateBps: 150, min: 1_000, max: 200_000 })
    ).toBe(200_000);
  });

  it('rounds to the nearest kobo', () => {
    // 333 kobo × 150 bps = 4.995 → rounds to 5; clamp band is wide enough to pass through.
    expect(computeClampedFee({ amount: 333, rateBps: 150, min: 0, max: 1_000 })).toBe(5);
  });
});
