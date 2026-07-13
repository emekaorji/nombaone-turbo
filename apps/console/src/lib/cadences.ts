import { cadenceApproxMs, intervalLabel, intervalShort, PRICE_INTERVALS } from '@nombaone/core-contracts/billing';

import type { PriceInterval } from '@nombaone/core-contracts/types';

/**
 * ── A cadence is a UNIT × a COUNT ─────────────────────────────────────────────
 *
 * The plan form used to key its fields by the interval alone (`amount_month`), which
 * silently hard-assumed `intervalCount = 1` — so the only cadences it could ever express
 * were the five units. That is why "every 10 minutes" (`minute × 10`) could not be
 * offered: it is not a unit, it is a pair.
 *
 * Everything here is keyed by the PAIR (`amount_minute_10`, `amount_month_1`), so the
 * form, the server action and the reconcile all speak the same language, and a cadence
 * the merchant already has — including an exotic one created through the API, like
 * `month × 3` — round-trips through the edit form untouched.
 */
export type Cadence = {
  /** `minute_10`, `month_1`. The form field is `amount_${key}`. */
  key: string;
  interval: PriceInterval;
  intervalCount: number;
  /** `every 10 minutes`, `monthly`, `annual`. */
  label: string;
};

export const cadenceKey = (interval: PriceInterval, intervalCount: number): string =>
  `${interval}_${intervalCount}`;

export const makeCadence = (interval: PriceInterval, intervalCount: number): Cadence => ({
  key: cadenceKey(interval, intervalCount),
  interval,
  intervalCount,
  label: intervalLabel(interval, intervalCount),
});

/**
 * The cadences the plan form offers, shortest first.
 *
 * `minute × 10` is a FIRST-CLASS cadence, not a test fixture: it is how a developer watches
 * a subscription actually renew — invoice, charge, webhook, ledger — while they are still
 * building, instead of waiting a month to find out it works. It bills through exactly the
 * same engine as `month`; nothing about it is special-cased, and it is offered in live mode
 * as well as sandbox, because a cadence that only exists in sandbox proves nothing about
 * live.
 *
 * This list is what the form OFFERS, not what the API accepts — `POST /v1/plans/{id}/prices`
 * takes any (interval, count) pair, and the edit form renders whatever a plan already has.
 */
export const PLAN_CADENCES: Cadence[] = [
  makeCadence('minute', 10),
  makeCadence('day', 1),
  makeCadence('week', 1),
  makeCadence('month', 1),
  makeCadence('year', 1),
].sort((a, b) => cadenceApproxMs(a.interval, a.intervalCount) - cadenceApproxMs(b.interval, b.intervalCount));

/** The default base cadence — what most plans sell on. */
export const DEFAULT_CADENCE_KEY = cadenceKey('month', 1);

/**
 * Parse a `${interval}_${count}` key back into a cadence.
 *
 * Validates BOTH halves against the engine's own enum rather than casting, so a hand-crafted
 * form post can never smuggle a unit the billing engine does not know into an insert. Accepts
 * any positive count, not just the offered ones — an exotic cadence the merchant already owns
 * must be able to round-trip through the edit form.
 */
export function parseCadenceKey(raw: string): Cadence | null {
  const at = raw.lastIndexOf('_');
  if (at <= 0) return null;
  const unit = raw.slice(0, at);
  const count = Number(raw.slice(at + 1));
  if (!(PRICE_INTERVALS as readonly string[]).includes(unit)) return null;
  if (!Number.isInteger(count) || count < 1) return null;
  return makeCadence(unit as PriceInterval, count);
}

/** The suffix beside an amount input: `/mo`, `/yr`, `/10 min`. */
export const cadenceSuffix = (c: Cadence): string =>
  c.intervalCount === 1 ? `/${intervalShort(c.interval)}` : `/${c.intervalCount} ${intervalShort(c.interval)}`;

/** Sort key so a ladder reads shortest → longest, whatever order the PG enum happens to carry. */
export const cadenceOrder = (a: Cadence, b: Cadence): number =>
  cadenceApproxMs(a.interval, a.intervalCount) - cadenceApproxMs(b.interval, b.intervalCount);
