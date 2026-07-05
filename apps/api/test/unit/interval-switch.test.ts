import { describe, expect, it } from 'vitest';

import { billingDateParts, periodBounds, reanchorForIntervalSwitch } from '@shared/services/billing';
import { buildIntervalSwitchLines, prorationNet } from '@shared/services/proration';

const MONTH = { interval: 'month' as const, intervalCount: 1 };

describe('proration/interval-switch lines (C4)', () => {
  it('credits the unused old-cadence remainder and charges the FULL new-cadence price', () => {
    const lines = buildIntervalSwitchLines({
      oldAmountKobo: 1_000_000, // ₦10k/month
      newAmountKobo: 12_000_000, // ₦120k/year (full, NOT prorated over the month)
      oldPeriodStart: new Date('2026-01-01T02:00:00Z'),
      oldPeriodEnd: new Date('2026-02-01T02:00:00Z'),
      newPeriodEnd: new Date('2027-01-16T02:00:00Z'),
      changeAt: new Date('2026-01-16T02:00:00Z'), // ~half the month used
      status: 'active',
      prorationBehavior: 'create_prorations',
    });
    expect(lines).toHaveLength(2);
    const credit = lines.find((l) => l.amount < 0)!;
    const charge = lines.find((l) => l.amount > 0)!;
    expect(charge.amount).toBe(12_000_000); // full year, not a monthly slice
    expect(credit.amount).toBeLessThan(0);
    expect(credit.amount).toBeGreaterThan(-1_000_000); // at most one month's worth
    expect(prorationNet(lines)).toBeGreaterThan(11_000_000); // ~12M − ~0.5M
  });

  it('no lines while trialing or when proration is off (C6)', () => {
    const base = {
      oldAmountKobo: 1_000_000, newAmountKobo: 12_000_000,
      oldPeriodStart: new Date('2026-01-01T02:00:00Z'), oldPeriodEnd: new Date('2026-02-01T02:00:00Z'),
      newPeriodEnd: new Date('2027-01-16T02:00:00Z'), changeAt: new Date('2026-01-16T02:00:00Z'),
    };
    expect(buildIntervalSwitchLines({ ...base, status: 'trialing', prorationBehavior: 'create_prorations' })).toHaveLength(0);
    expect(buildIntervalSwitchLines({ ...base, status: 'active', prorationBehavior: 'none' })).toHaveLength(0);
  });
});

describe('scheduling/reanchorForIntervalSwitch (C4) — index-safe, consistent re-anchor', () => {
  it('keeps runCycle consistent: periodBounds(anchor, newPrice, currentIndex).start === nextBillingAt', () => {
    const changeAt = new Date('2026-01-15T10:00:00Z');
    for (const index of [1, 3, 12, 40]) {
      const r = reanchorForIntervalSwitch(changeAt, index, MONTH);
      // The invariant runCycle relies on: the derived next boundary matches the stored cursor.
      expect(periodBounds(r.anchor, MONTH, index).start.getTime()).toBe(r.nextBillingAt.getTime());
      expect(r.currentPeriodEnd.getTime()).toBe(r.nextBillingAt.getTime());
      // The next bill is ~one month after the switch (billing-zone date 15).
      expect(billingDateParts(r.nextBillingAt).day).toBe(15);
      expect(billingDateParts(r.nextBillingAt).month).toBe(2);
    }
  });

  it('is end-of-month safe: a Jan-31 switch re-anchors to the snapped Feb boundary without drift', () => {
    const changeAt = new Date('2026-01-31T10:00:00Z');
    const r = reanchorForIntervalSwitch(changeAt, 5, MONTH);
    // Feb (2026, non-leap) snaps day 31 → 28; the derived cursor stays self-consistent.
    expect(billingDateParts(r.nextBillingAt)).toMatchObject({ year: 2026, month: 2, day: 28 });
    expect(periodBounds(r.anchor, MONTH, 5).start.getTime()).toBe(r.nextBillingAt.getTime());
  });

  it('yearly cadence: the next boundary is ~a year out and self-consistent', () => {
    const changeAt = new Date('2026-03-10T10:00:00Z');
    const YEAR = { interval: 'year' as const, intervalCount: 1 };
    const r = reanchorForIntervalSwitch(changeAt, 7, YEAR);
    expect(periodBounds(r.anchor, YEAR, 7).start.getTime()).toBe(r.nextBillingAt.getTime());
    expect(billingDateParts(r.nextBillingAt)).toMatchObject({ year: 2027, month: 3, day: 10 });
  });
});
