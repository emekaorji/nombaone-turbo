import { describe, expect, it } from 'vitest';

import {
  convertIntervalKobo,
  PRICE_INTERVALS,
  savingsPct,
  toMonthlyKobo,
} from '@nombaone/core-contracts/billing';
import { priceIntervalEnum } from '@nombaone/core-db/schema';

import {
  addIntervalFromAnchor,
  billingDateParts,
  billingInstant,
  computeAnchor,
  computeAnchorAtOrAfter,
  daysInMonth,
  isDue,
  isLeapYear,
  periodBounds,
  reanchorForIntervalSwitch,
} from '@shared/services/billing';

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

  it('computeAnchor normalizes a CALENDAR cadence to the billing hour (02:00 Africa/Lagos = 01:00 UTC)', () => {
    expect(computeAnchor(new Date('2026-06-15T09:37:00Z'), 'month').toISOString()).toBe(
      '2026-06-15T01:00:00.000Z'
    );
  });
});

describe('billing/scheduling — wall-clock cadences (minute × N)', () => {
  const tenMinutely = { interval: 'minute' as const, intervalCount: 10 };
  const activation = new Date('2026-06-15T14:37:22.000Z');

  it('the anchor is the activation INSTANT, not the billing hour', () => {
    // The whole point: a 10-minute sub started at 14:37 bills at 14:47. Normalizing to
    // 02:00 would put every boundary on the same instant — a zero-length period.
    expect(computeAnchor(activation, 'minute').toISOString()).toBe('2026-06-15T14:37:22.000Z');
  });

  it('periods are exact 10-minute windows, contiguous and non-empty', () => {
    const anchor = computeAnchor(activation, 'minute');
    const p0 = periodBounds(anchor, tenMinutely, 0);
    const p1 = periodBounds(anchor, tenMinutely, 1);

    expect(p0.start.toISOString()).toBe('2026-06-15T14:37:22.000Z');
    expect(p0.end.toISOString()).toBe('2026-06-15T14:47:22.000Z');
    expect(p1.start.getTime()).toBe(p0.end.getTime()); // contiguous
    expect(p1.end.getTime() - p1.start.getTime()).toBe(10 * 60_000); // never zero-length
  });

  it('bounds are computed FROM THE ANCHOR, so 1000 periods accumulate zero drift', () => {
    const anchor = computeAnchor(activation, 'minute');
    const p1000 = periodBounds(anchor, tenMinutely, 1000);
    expect(p1000.start.getTime()).toBe(anchor.getTime() + 1000 * 10 * 60_000);
  });

  it('a wall-clock anchor is already at-or-after the trial end (no billing-hour roll)', () => {
    const trialEnd = new Date('2026-06-16T09:15:00.000Z');
    expect(computeAnchorAtOrAfter(trialEnd, 'minute').getTime()).toBe(trialEnd.getTime());
  });

  it('addIntervalFromAnchor REFUSES a wall-clock unit instead of silently billing months', () => {
    // The landmine this replaced: the old `if (day||week) … else month/year` chain
    // sent 'minute' down the month branch, so a 10-minute plan billed every 10 MONTHS.
    expect(() => addIntervalFromAnchor({ year: 2026, month: 6, day: 15 }, 'minute', 1)).toThrow(
      /wall-clock unit/
    );
  });

  it('an interval switch onto a wall-clock cadence re-anchors without colliding period indexes', () => {
    const changeAt = new Date('2026-06-15T14:37:22.000Z');
    const r = reanchorForIntervalSwitch(changeAt, 12, tenMinutely);

    expect(r.currentPeriodStart.getTime()).toBe(changeAt.getTime());
    expect(r.nextBillingAt.getTime()).toBe(changeAt.getTime() + 10 * 60_000);
    expect(r.currentPeriodEnd.getTime()).toBe(r.nextBillingAt.getTime());
    // The anchor is back-dated so index 12 (unchanged, still monotonic) lands on the
    // next boundary — exactly the invariant the calendar branch upholds.
    expect(periodBounds(r.anchor, tenMinutely, 12).start.getTime()).toBe(r.nextBillingAt.getTime());
  });
});

describe('billing/scheduling — the contract enum and the Postgres enum cannot drift', () => {
  it('PRICE_INTERVALS === price_interval', () => {
    // Two hand-authored lists in two packages (core-contracts cannot import core-db
    // without closing a package cycle). This is the lock that keeps them honest: a
    // value added to one and not the other fails here, not in production.
    expect([...priceIntervalEnum.enumValues].sort()).toEqual([...PRICE_INTERVALS].sort());
  });
});

describe('billing/interval — cadence conversion (the console price-derivation suggestion)', () => {
  it('month → year and back is the identity for a whole-naira figure', () => {
    // ₦5,000/mo suggests ₦60,000/yr; the annual figure suggests the monthly one back.
    expect(convertIntervalKobo(500_000, 'month', 1, 'year', 1)).toBe(6_000_000);
    expect(convertIntervalKobo(6_000_000, 'year', 1, 'month', 1)).toBe(500_000);
  });

  it('day → month uses the 365-day year (×365/12), the same basis as toMonthlyKobo', () => {
    // The exact drift this module exists to prevent: the console once valued a daily
    // price at ×30/month. 100_00 kobo/day ⇒ 100_00 × 365 / 12 = 304_167 kobo/month.
    expect(convertIntervalKobo(10_000, 'day', 1, 'month', 1)).toBe(304_167);
    expect(convertIntervalKobo(10_000, 'day', 1, 'month', 1)).toBe(
      toMonthlyKobo(10_000, 'day', 1)
    );
  });

  it('honours intervalCount on BOTH sides (quarterly ↔ annual)', () => {
    // ₦15,000 every 3 months = ₦60,000/yr; and ₦60,000/yr back onto month × 3.
    expect(convertIntervalKobo(1_500_000, 'month', 3, 'year', 1)).toBe(6_000_000);
    expect(convertIntervalKobo(6_000_000, 'year', 1, 'month', 3)).toBe(1_500_000);
    // A 2-week cadence is worth twice a 1-week one on the same annual basis.
    expect(convertIntervalKobo(6_000_000, 'year', 1, 'week', 2)).toBe(230_769);
  });

  it('converts onto the wall-clock cadence without a special case', () => {
    // `minute` is just another unit here — the exclusion belongs in the picker, not
    // the math. ₦60,000/yr ⇒ 6_000_000 / 525_600 ≈ 11 kobo per minute.
    expect(convertIntervalKobo(6_000_000, 'year', 1, 'minute', 1)).toBe(11);
    expect(convertIntervalKobo(6_000_000, 'year', 1, 'minute', 10)).toBe(114);
  });

  it('clamps to 1 kobo so a derived figure can never violate CHECK (unit_amount > 0)', () => {
    // ₦1/day is a fraction of a kobo per minute — rounding would land on 0 and the
    // insert would be rejected. Suggest the floor instead.
    expect(convertIntervalKobo(100, 'day', 1, 'minute', 1)).toBe(1);
    expect(convertIntervalKobo(1, 'year', 1, 'minute', 1)).toBe(1);
  });
});

describe('billing/interval — savingsPct (the "save 17%" badge)', () => {
  it('the annual discount case: ₦50,000/yr against ₦5,000/mo is 17%', () => {
    expect(savingsPct(500_000, toMonthlyKobo(5_000_000, 'year', 1))).toBe(17);
  });

  it('an identically-priced cadence saves nothing', () => {
    expect(savingsPct(500_000, toMonthlyKobo(6_000_000, 'year', 1))).toBe(0);
  });

  it('a baseline of 0 is not a division by zero', () => {
    expect(savingsPct(0, 416_667)).toBe(0);
    expect(savingsPct(-1, 416_667)).toBe(0);
  });

  it('a cadence that costs MORE per month returns a NEGATIVE percent, never a clamped 0', () => {
    // ₦72,000/yr against a ₦5,000/mo baseline is a 20% PREMIUM. Clamping would launder
    // a mispriced annual plan into a neutral one; the UI badges only when > 0.
    expect(savingsPct(500_000, toMonthlyKobo(7_200_000, 'year', 1))).toBe(-20);
  });
});
