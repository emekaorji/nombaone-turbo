import { describe, expect, it } from 'vitest';

import { nairaToKobo, sumKobo } from '@nombaone/sara/money';

/**
 * Money is always integer minor units (kobo); ₦1.00 = 100 kobo.
 */
describe('money.nairaToKobo', () => {
  it('converts naira to integer kobo', () => {
    expect(nairaToKobo(1)).toBe(100);
    expect(nairaToKobo(1234.5)).toBe(123_450);
  });

  it('rounds to the nearest kobo (no floating-point drift)', () => {
    // 0.1 + 0.2 style inputs must not leak fractional kobo.
    expect(nairaToKobo(0.1)).toBe(10);
    expect(nairaToKobo(19.999)).toBe(2_000);
  });
});

describe('money.sumKobo', () => {
  it('sums an array of kobo values', () => {
    expect(sumKobo([100, 250, 50])).toBe(400);
  });

  it('returns 0 for an empty array', () => {
    expect(sumKobo([])).toBe(0);
  });
});
