import { billingDateParts, billingInstant } from '../billing/scheduling';

import type { ResolvedDunningPolicy } from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const intervalHoursFor = (policy: ResolvedDunningPolicy, attemptIndex: number): number => {
  const arr = policy.dunningIntervalsHours;
  if (arr.length === 0) return 24;
  return arr[Math.min(Math.max(attemptIndex, 0), arr.length - 1)] ?? 24;
};

/** The naive next-attempt instant: base + the configured interval for this attempt. */
export function rawNextAttemptAt(
  baseAt: Date,
  attemptIndex: number,
  policy: ResolvedDunningPolicy
): Date {
  return new Date(baseAt.getTime() + intervalHoursFor(policy, attemptIndex) * HOUR_MS);
}

/**
 * Payday-biased next attempt (D12 ★). Compute the raw candidate from the tenant's
 * interval, then — when the bias is enabled — snap it FORWARD onto the first
 * configured payday within `paydayPullForwardDays` days (in the fixed billing zone),
 * so an `insufficient_funds` retry lands when salaries are most likely in. The snap
 * never moves the attempt EARLIER than the raw candidate. Deterministic, TZ-fixed
 * (reuses 04's billing clock), no float, no `Date` drift — safe across month-end /
 * EOM / leap because `billingDateParts` walks the real calendar.
 */
export function nextPaydayBiasedAttemptAt(
  baseAt: Date,
  attemptIndex: number,
  policy: ResolvedDunningPolicy
): Date {
  const candidate = rawNextAttemptAt(baseAt, attemptIndex, policy);
  if (!policy.paydayBiasEnabled || policy.paydayDays.length === 0) return candidate;

  const paydays = new Set(policy.paydayDays);
  const baseInstant = billingInstant(billingDateParts(candidate)); // 2am local on candidate's date
  for (let offset = 0; offset <= policy.paydayPullForwardDays; offset += 1) {
    const walked = billingDateParts(new Date(baseInstant.getTime() + offset * DAY_MS));
    if (paydays.has(walked.day)) {
      const snapped = billingInstant(walked);
      if (snapped.getTime() >= candidate.getTime()) return snapped;
    }
  }
  return candidate;
}

/** Dunning is over when attempts hit the cap OR the max window elapses (D6). */
export function isDunningExhausted(
  attemptsUsed: number,
  firstFailedAt: Date,
  now: Date,
  policy: ResolvedDunningPolicy
): boolean {
  if (attemptsUsed >= policy.dunningMaxAttempts) return true;
  return now.getTime() >= firstFailedAt.getTime() + policy.dunningMaxWindowHours * HOUR_MS;
}

/** A subscriber keeps access during `past_due` until the grace window elapses (D7). */
export function hasGraceAccess(
  firstFailedAt: Date,
  now: Date,
  policy: ResolvedDunningPolicy
): boolean {
  return now.getTime() < firstFailedAt.getTime() + policy.gracePeriodHours * HOUR_MS;
}

/** The instant grace access ends (for surfacing in the dunning state view). */
export function graceAccessUntil(firstFailedAt: Date, policy: ResolvedDunningPolicy): Date {
  return new Date(firstFailedAt.getTime() + policy.gracePeriodHours * HOUR_MS);
}
