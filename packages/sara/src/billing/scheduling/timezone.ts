/**
 * ── The single fixed billing clock (D.3) ─────────────────────────────────────
 *
 * Every period boundary is computed in ONE zone at ONE hour, so "due today" is a
 * single unambiguous UTC instant (B5). `Africa/Lagos` is UTC+1 with **no DST** — a
 * deliberate, stable choice for the Nigerian market that lets boundaries be a fixed
 * offset (no tz database, no DST ambiguity). A DST zone would need a real tz lib;
 * this market does not. The zone/hour mirror `env.ts` (`BILLING_TIMEZONE` /
 * `BILLING_HOUR`); these constants are the pure-math source of truth.
 */
export const BILLING_TIMEZONE = 'Africa/Lagos';
export const BILLING_HOUR = 2;
/** Africa/Lagos is a constant UTC+1 (WAT), no daylight saving. */
const BILLING_UTC_OFFSET_HOURS = 1;

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

/** The calendar Y/M/D of a UTC instant AS SEEN in the billing zone. */
export function billingDateParts(instant: Date): DateParts {
  const shifted = new Date(instant.getTime() + BILLING_UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** The UTC instant of `BILLING_HOUR` local on the given billing-zone date. */
export function billingInstant(parts: DateParts): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, BILLING_HOUR - BILLING_UTC_OFFSET_HOURS, 0, 0, 0)
  );
}

/** A subscription is due the instant its period end has passed (half-open period). */
export function isDue(periodEnd: Date, now: Date): boolean {
  return periodEnd.getTime() <= now.getTime();
}
