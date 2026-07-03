import { describe, expect, it } from 'vitest';

import { railKeyForMethod, rollPeriod } from '@nombaone/sara/billing';

describe('billing/rollPeriod — naive UTC roll (04 owns anchor/EOM math)', () => {
  const base = new Date('2026-01-15T00:00:00Z');

  it('rolls day / week / month / year by count', () => {
    expect(rollPeriod(base, 'day', 3).toISOString()).toBe('2026-01-18T00:00:00.000Z');
    expect(rollPeriod(base, 'week', 2).toISOString()).toBe('2026-01-29T00:00:00.000Z');
    expect(rollPeriod(base, 'month', 1).toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect(rollPeriod(base, 'year', 1).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('does not mutate the input date', () => {
    rollPeriod(base, 'month', 5);
    expect(base.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('billing/railKeyForMethod — kind → rail key (never a provider name)', () => {
  it('maps each payment-method kind to its rail key', () => {
    expect(railKeyForMethod('card')).toBe('card');
    expect(railKeyForMethod('mandate')).toBe('mandate');
    expect(railKeyForMethod('virtual_account')).toBe('transfer');
  });
});
