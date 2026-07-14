/**
 * Money and time, formatted the way a member reads them — never the way a machine
 * stores them.
 *
 * Everything on the wire is integer KOBO. This file is the only place that becomes naira,
 * and the only place a timestamp becomes a sentence. If a page ever formats its own date,
 * two screens will eventually disagree about when a member is being charged — which is
 * the single most damaging thing this product could get wrong.
 */

const LAGOS = 'Africa/Lagos';

/** 3_500_000 kobo → "₦35,000". Drops the ".00" — nobody writes ₦35,000.00 on a poster. */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  const whole = Number.isInteger(naira);
  return `₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "Thursday, 13 August 2026" — for anything a person plans around. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: LAGOS,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "13 Aug 2026" — for dense rows. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: LAGOS,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "14:32" — Lagos wall clock. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: LAGOS,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "in 6 minutes" / "in 3 days" / "today".
 *
 * A Flex Pass renews every ten minutes. Telling someone their next payment is on
 * "Thursday, 13 August" when it is actually four minutes away would be technically true
 * and completely useless — so short horizons get a countdown and long ones get a date.
 */
export function relative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60_000);

  if (mins <= 0) return 'any moment now';
  if (mins === 1) return 'in 1 minute';
  if (mins < 60) return `in ${mins} minutes`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'tomorrow';
  if (days < 31) return `in ${days} days`;

  const months = Math.round(days / 30);
  return months === 1 ? 'in about a month' : `in about ${months} months`;
}

/** True when the next payment is close enough that a date alone would be unhelpful. */
export const isImminent = (iso: string): boolean =>
  new Date(iso).getTime() - Date.now() < 6 * 60 * 60 * 1000;

/**
 * The one sentence that says when money leaves a member's account.
 *
 *   long horizon  → "on Thursday, 13 August 2026"
 *   short horizon → "at 14:32 — in 6 minutes"
 */
export function whenPhrase(iso: string): string {
  return isImminent(iso) ? `at ${formatTime(iso)} — ${relative(iso)}` : `on ${formatDate(iso)}`;
}

/** "every month" / "every year" / "every 10 minutes" — how often, in words. */
export function cadence(interval: string, count: number): string {
  const unit = count === 1 ? interval : `${count} ${interval}s`;
  return `every ${unit}`;
}
