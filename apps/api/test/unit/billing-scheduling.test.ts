import { describe, expect, it } from 'vitest';

import {
  addIntervalFromAnchor,
  billingDateParts,
  billingInstant,
  computeAnchor,
  daysInMonth,
  isDue,
  isLeapYear,
  periodBounds,
} from '@/domain/billing';

const monthly = { interval: 'month' as const, intervalCount: 1 };
const annual = { interval: 'year' as const, intervalCount: 1 };

describe('billing/scheduling — leap helpers', () => {
  it('isLeapYear (incl. century rule)', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
  it('daysInMonth is leap-aware for February', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('billing/scheduling — EOM snap-back (B3)', () => {
  it('a Jan-31 monthly anchor walks the year and snaps back to 31, never 28', () => {
    const anchor = billingInstant({ year: 2026, month: 1, day: 31 });
    const doms: number[] = [];
    for (let i = 0; i <= 12; i++) {
      doms.push(billingDateParts(periodBounds(anchor, monthly, i).start).day);
    }
    //          Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec Jan
    expect(doms).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31]);
  });

  it('addIntervalFromAnchor never destroys the anchor day-of-month', () => {
    const anchor = { year: 2026, month: 1, day: 31 };
    expect(addIntervalFromAnchor(anchor, 'month', 1)).toMatchObject({ month: 2, day: 28 });
    expect(addIntervalFromAnchor(anchor, 'month', 2)).toMatchObject({ month: 3, day: 31 });
    expect(addIntervalFromAnchor(anchor, 'month', 3)).toMatchObject({ month: 4, day: 30 });
  });
});

describe('billing/scheduling — leap-day annual (B4)', () => {
  it('a Feb-29 annual anchor lands 28 in common years and 29 in leap years', () => {
    const anchor = billingInstant({ year: 2024, month: 2, day: 29 }); // leap
    const dom = (i: number): number => billingDateParts(periodBounds(anchor, annual, i).start).day;
    expect(dom(0)).toBe(29); // 2024 (leap)
    expect(dom(1)).toBe(28); // 2025
    expect(dom(2)).toBe(28); // 2026
    expect(dom(3)).toBe(28); // 2027
    expect(dom(4)).toBe(29); // 2028 (leap) — snaps back to 29
  });
});

describe('billing/scheduling — custom intervals (B1)', () => {
  it('weekly × 2 and daily × 10 are exact multiples', () => {
    const anchor = billingInstant({ year: 2026, month: 3, day: 1 });
    expect(billingDateParts(periodBounds(anchor, { interval: 'week', intervalCount: 2 }, 0).end)).toMatchObject({
      year: 2026,
      month: 3,
      day: 15,
    });
    expect(billingDateParts(periodBounds(anchor, { interval: 'day', intervalCount: 10 }, 0).end)).toMatchObject({
      month: 3,
      day: 11,
    });
  });
});

describe('billing/scheduling — anchor-based bounds (B2) + due (B5)', () => {
  it('periods are contiguous and anchor-based: period N start === period N-1 end', () => {
    const anchor = billingInstant({ year: 2026, month: 6, day: 15 });
    for (let i = 1; i <= 13; i++) {
      const prev = periodBounds(anchor, monthly, i - 1);
      const cur = periodBounds(anchor, monthly, i);
      expect(cur.start.getTime()).toBe(prev.end.getTime());
    }
  });

  it('isDue is one exact instant — one second before the boundary is NOT due', () => {
    const anchor = billingInstant({ year: 2026, month: 6, day: 15 });
    const { end } = periodBounds(anchor, monthly, 0);
    expect(isDue(end, new Date(end.getTime() - 1000))).toBe(false);
    expect(isDue(end, end)).toBe(true);
    expect(isDue(end, new Date(end.getTime() + 1000))).toBe(true);
  });

  it('computeAnchor normalizes to the billing hour (02:00 Africa/Lagos = 01:00 UTC)', () => {
    expect(computeAnchor(new Date('2026-06-15T09:37:00Z')).toISOString()).toBe('2026-06-15T01:00:00.000Z');
  });
});
