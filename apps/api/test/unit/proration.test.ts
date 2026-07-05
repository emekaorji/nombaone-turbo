import { describe, expect, it } from 'vitest';

import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  assertDistributionExact,
  buildProrationLines,
  distributeKobo,
  prorate,
  prorationNet,
  resolvePartialCollection,
} from '@/domain/proration';

import type { BuildProrationInput } from '@/domain/proration';

describe('proration/prorate — floor-division, no float (J1/C3)', () => {
  it('floors exactly', () => {
    expect(prorate(10000, 1, 2)).toBe(5000);
    expect(prorate(10001, 1, 3)).toBe(3333); // floor(10001/3)
    expect(prorate(10000, 0, 2)).toBe(0);
  });
  it('clamps remaining into [0, total]', () => {
    expect(prorate(10000, 5, 2)).toBe(10000); // remaining > total → total
    expect(prorate(10000, -1, 2)).toBe(0);
  });
  it('rejects a non-positive period', () => {
    let code: string | undefined;
    try {
      prorate(10000, 1, 0);
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe(NOMBAONE_ERROR_CODES.PRORATION_PERIOD_INVALID);
  });
});

describe('proration/distributeKobo — sum-of-parts = total to the kobo (C3 ★)', () => {
  const cases: Array<{ total: number; weights: number[] }> = [
    { total: 100, weights: [1, 1, 1] },
    { total: 10, weights: [1, 1, 1] },
    { total: 7, weights: [3, 1] },
    { total: 100003, weights: [5, 3, 2, 1] }, // indivisible — the rounding-leak case
    { total: 1, weights: [1, 1, 1, 1] },
    { total: 999999, weights: [7, 7, 7] },
    { total: 500, weights: [0, 0, 0] }, // degenerate weights
  ];
  it('always sums to the total exactly', () => {
    for (const { total, weights } of cases) {
      const parts = distributeKobo(total, weights);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
      expect(() => assertDistributionExact(parts, total)).not.toThrow();
      expect(parts.length).toBe(weights.length);
    }
  });
  it('is deterministic (largest-remainder, ties by index)', () => {
    expect(distributeKobo(7, [3, 1])).toEqual([5, 2]);
    expect(distributeKobo(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });
  it('assertDistributionExact throws on a mismatch', () => {
    let code: string | undefined;
    try {
      assertDistributionExact([3, 3], 7);
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe(NOMBAONE_ERROR_CODES.PRORATION_DISTRIBUTION_UNBALANCED);
  });
});

describe('proration/buildProrationLines (C1/C2/C5/C6)', () => {
  const base: Omit<BuildProrationInput, 'oldAmountKobo' | 'newAmountKobo' | 'status'> = {
    periodStart: new Date(0),
    periodEnd: new Date(100_000), // 100s period
    changeAt: new Date(50_000), // half-way
    prorationBehavior: 'create_prorations',
  };

  it('upgrade → unused-old credit + new charge, net positive (C1)', () => {
    const lines = buildProrationLines({ ...base, oldAmountKobo: 1_000_000, newAmountKobo: 1_500_000, status: 'active' });
    expect(lines.map((l) => l.amount)).toEqual([-500_000, 750_000]);
    expect(prorationNet(lines)).toBe(250_000);
  });

  it('downgrade → net negative (banked as credit) (C2)', () => {
    const lines = buildProrationLines({ ...base, oldAmountKobo: 1_500_000, newAmountKobo: 1_000_000, status: 'active' });
    expect(prorationNet(lines)).toBe(-250_000);
  });

  it('seat increase prorates the delta the same upgrade shape (C5)', () => {
    // 2 seats → 3 seats at ₦5,000/seat for the remaining half.
    const lines = buildProrationLines({ ...base, oldAmountKobo: 1_000_000, newAmountKobo: 1_500_000, status: 'active' });
    expect(prorationNet(lines)).toBe(250_000);
  });

  it('NO proration during a trial (C6)', () => {
    expect(buildProrationLines({ ...base, oldAmountKobo: 1_000_000, newAmountKobo: 1_500_000, status: 'trialing' })).toEqual([]);
  });

  it('NO proration when behavior is none', () => {
    expect(
      buildProrationLines({ ...base, oldAmountKobo: 1_000_000, newAmountKobo: 1_500_000, status: 'active', prorationBehavior: 'none' })
    ).toEqual([]);
  });
});

describe('proration/resolvePartialCollection', () => {
  it('full payment → paid', () => {
    expect(resolvePartialCollection(true, 1000, 1000)).toEqual({ status: 'paid', amountRemaining: 0 });
  });
  it('short + enabled → partially_paid with remainder', () => {
    expect(resolvePartialCollection(true, 1000, 600)).toEqual({ status: 'partially_paid', amountRemaining: 400 });
  });
  it('short + disabled (default) → open, all-or-nothing', () => {
    expect(resolvePartialCollection(false, 1000, 600)).toEqual({ status: 'open', amountRemaining: 1000 });
  });
});
