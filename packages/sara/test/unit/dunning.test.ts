import { describe, expect, it } from 'vitest';

import { billingDateParts } from '@nombaone/sara/billing';
import {
  classifyDunningBranch,
  graceAccessUntil,
  hasGraceAccess,
  isDunningExhausted,
  nextPaydayBiasedAttemptAt,
  PLATFORM_DEFAULT_DUNNING_POLICY,
  rawNextAttemptAt,
  type ResolvedDunningPolicy,
} from '@nombaone/sara/dunning';

const policy = (over: Partial<ResolvedDunningPolicy> = {}): ResolvedDunningPolicy => ({
  ...PLATFORM_DEFAULT_DUNNING_POLICY,
  ...over,
});

describe('dunning/classify — reason → branch (D3/D4/D5)', () => {
  it('expired_card and token_expired ALWAYS go to card_update_required (never a blind retry)', () => {
    expect(classifyDunningBranch('expired_card')).toBe('card_update_required');
    expect(classifyDunningBranch('token_expired')).toBe('card_update_required');
    // the ★ D4 guarantee: never reschedule a charge that cannot succeed
    expect(classifyDunningBranch('expired_card')).not.toBe('reschedule');
    expect(classifyDunningBranch('token_expired')).not.toBe('reschedule');
  });

  it('the hard-refusal family takes the short path', () => {
    expect(classifyDunningBranch('hard_decline')).toBe('short_path');
    expect(classifyDunningBranch('do_not_honor')).toBe('short_path');
    expect(classifyDunningBranch('mandate_suspended')).toBe('short_path');
  });

  it('insufficient_funds and transient reasons reschedule on the normal cadence', () => {
    expect(classifyDunningBranch('insufficient_funds')).toBe('reschedule');
    expect(classifyDunningBranch('processor_unavailable')).toBe('reschedule');
    expect(classifyDunningBranch('unknown')).toBe('reschedule');
  });
});

describe('dunning/schedule — payday-biased cadence (D12 ★)', () => {
  it('rawNextAttemptAt uses the configured interval for the attempt index, clamped to the last', () => {
    const base = new Date('2026-01-10T06:00:00Z');
    const p = policy({ dunningIntervalsHours: [24, 72], paydayBiasEnabled: false });
    expect(rawNextAttemptAt(base, 0, p).getTime()).toBe(base.getTime() + 24 * 3_600_000);
    expect(rawNextAttemptAt(base, 1, p).getTime()).toBe(base.getTime() + 72 * 3_600_000);
    expect(rawNextAttemptAt(base, 5, p).getTime()).toBe(base.getTime() + 72 * 3_600_000); // clamp
  });

  it('snaps a candidate a few days before a payday FORWARD onto the payday', () => {
    // candidate = base + 24h → 2026-01-23 (Lagos); nearest payday 26 within 4 days → snap to 26.
    const base = new Date('2026-01-22T06:00:00Z');
    const at = nextPaydayBiasedAttemptAt(base, 0, policy());
    expect(billingDateParts(at).day).toBe(26);
  });

  it('leaves the candidate alone when no payday is within the pull-forward window', () => {
    const base = new Date('2026-01-09T06:00:00Z'); // candidate 2026-01-10, nothing in [10..14] is a payday
    const p = policy();
    const at = nextPaydayBiasedAttemptAt(base, 0, p);
    expect(at.getTime()).toBe(rawNextAttemptAt(base, 0, p).getTime());
  });

  it('bias disabled → the raw candidate is returned unchanged (used for hard declines)', () => {
    const base = new Date('2026-01-22T06:00:00Z');
    const p = policy({ paydayBiasEnabled: false });
    expect(nextPaydayBiasedAttemptAt(base, 0, p).getTime()).toBe(rawNextAttemptAt(base, 0, p).getTime());
  });

  it('rolls month-end correctly (Feb 27 → Feb 28 payday)', () => {
    const base = new Date('2026-02-26T06:00:00Z'); // candidate 2026-02-27 Lagos
    const at = nextPaydayBiasedAttemptAt(base, 0, policy());
    expect(billingDateParts(at).day).toBe(28);
    expect(billingDateParts(at).month).toBe(2);
  });

  it('is leap-aware: snaps onto Feb 29 in a leap year, but never invents it in a common year', () => {
    const leapBase = new Date('2028-02-26T06:00:00Z'); // candidate 2028-02-27; Feb 29 exists
    const leapAt = nextPaydayBiasedAttemptAt(leapBase, 0, policy({ paydayDays: [29] }));
    expect(billingDateParts(leapAt)).toMatchObject({ year: 2028, month: 2, day: 29 });

    const commonBase = new Date('2027-02-25T06:00:00Z'); // candidate 2027-02-26; no Feb 29
    const p = policy({ paydayDays: [29] });
    const commonAt = nextPaydayBiasedAttemptAt(commonBase, 0, p);
    expect(commonAt.getTime()).toBe(rawNextAttemptAt(commonBase, 0, p).getTime()); // no phantom snap
  });
});

describe('dunning/schedule — exhaustion + grace boundaries (D6/D7)', () => {
  const firstFailed = new Date('2026-03-01T00:00:00Z');
  const p = policy({ dunningMaxAttempts: 4, dunningMaxWindowHours: 336, gracePeriodHours: 72 });

  it('isDunningExhausted at the attempt cap and at the window edge', () => {
    expect(isDunningExhausted(3, firstFailed, new Date('2026-03-02T00:00:00Z'), p)).toBe(false);
    expect(isDunningExhausted(4, firstFailed, new Date('2026-03-02T00:00:00Z'), p)).toBe(true); // cap
    const windowEdge = new Date(firstFailed.getTime() + 336 * 3_600_000);
    expect(isDunningExhausted(1, firstFailed, new Date(windowEdge.getTime() - 1), p)).toBe(false);
    expect(isDunningExhausted(1, firstFailed, windowEdge, p)).toBe(true); // window
  });

  it('hasGraceAccess within the window, revoked exactly at the edge', () => {
    const graceEdge = graceAccessUntil(firstFailed, p);
    expect(graceEdge.getTime()).toBe(firstFailed.getTime() + 72 * 3_600_000);
    expect(hasGraceAccess(firstFailed, new Date(graceEdge.getTime() - 1), p)).toBe(true);
    expect(hasGraceAccess(firstFailed, graceEdge, p)).toBe(false);
  });
});

describe('dunning/policy — platform default (D2)', () => {
  it('mirrors the org_billing_settings column defaults', () => {
    expect(PLATFORM_DEFAULT_DUNNING_POLICY).toMatchObject({
      dunningMaxAttempts: 4,
      dunningIntervalsHours: [24, 72, 120, 168],
      dunningMaxWindowHours: 336,
      gracePeriodHours: 72,
      paydayDays: [26, 27, 28, 29, 30, 1],
      paydayPullForwardDays: 4,
      paydayBiasEnabled: true,
    });
  });
});
