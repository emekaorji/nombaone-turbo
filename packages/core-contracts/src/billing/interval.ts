/**
 * ── The billing interval: ONE declaration of the cadence unit ─────────────────
 *
 * A price's cadence is a UNIT × a COUNT — `interval: 'minute', intervalCount: 10`
 * is every ten minutes. The count is what keeps the model closed: quarterly is
 * `month × 3`, hourly is `minute × 60`. So this list grows only when a genuinely
 * new UNIT of time is needed, never to name a multiple of a unit we already have.
 *
 * Units come in two families, and the split is load-bearing, not cosmetic:
 *
 *   CALENDAR (day / week / month / year) — a period boundary is a calendar DATE
 *   normalized to the billing hour (02:00 Africa/Lagos). Month and year snap the
 *   end-of-month against the anchor's day-of-month, so a period's wall-clock
 *   length is NOT constant. See `scheduling/timezone.ts`.
 *
 *   WALL-CLOCK (minute) — a period boundary is an exact elapsed offset from the
 *   anchor INSTANT, deliberately NOT normalized to the billing hour. Normalizing
 *   a sub-day cadence would collapse every boundary in a period onto the same
 *   02:00 instant, i.e. a zero-length period: the subscription would be
 *   perpetually due and would bill until the catch-up guard tripped.
 *
 * Consumers MUST switch exhaustively over `PriceInterval` and close with
 * `assertNever`, never with a `default` that falls through. A silent default here
 * does not throw — it misprices money.
 */

/**
 * The valid cadence units.
 *
 * Order mirrors the Postgres `price_interval` enum's PHYSICAL order, which is
 * append-only: `ALTER TYPE … ADD VALUE` appends, and reordering an existing enum
 * needs a destructive type recreate. **Put new units at the END.** The two lists
 * are locked together by a test (`apps/api/test/unit/billing-scheduling.test.ts`).
 */
export const PRICE_INTERVALS = ['day', 'week', 'month', 'year', 'minute'] as const;
export type PriceInterval = (typeof PRICE_INTERVALS)[number];

/** Units whose boundaries are exact elapsed time from the anchor instant. */
export const WALL_CLOCK_INTERVALS = ['minute'] as const;
export type WallClockInterval = (typeof WALL_CLOCK_INTERVALS)[number];
export type CalendarInterval = Exclude<PriceInterval, WallClockInterval>;

export function isWallClockInterval(interval: PriceInterval): interval is WallClockInterval {
  return (WALL_CLOCK_INTERVALS as readonly string[]).includes(interval);
}

const MINUTE_MS = 60_000;

/** Exact milliseconds in one unit of a wall-clock cadence. */
export function wallClockStepMs(interval: WallClockInterval): number {
  switch (interval) {
    case 'minute':
      return MINUTE_MS;
    default:
      return assertNever(interval, `wallClockStepMs: unhandled interval ${String(interval)}`);
  }
}

/**
 * How many periods of one unit fit in a year — the basis for normalizing any
 * cadence to a monthly figure (÷ 12). A 365-day year, matching the `day`
 * multiplier this engine has always used.
 */
export function periodsPerYear(interval: PriceInterval): number {
  switch (interval) {
    case 'minute':
      return 365 * 24 * 60; // 525_600
    case 'day':
      return 365;
    case 'week':
      return 52;
    case 'month':
      return 12;
    case 'year':
      return 1;
    default:
      return assertNever(interval, `periodsPerYear: unhandled interval ${String(interval)}`);
  }
}

/**
 * Normalize a recurring amount to a MONTHLY figure in integer kobo.
 *
 * The ONE implementation: the API's MRR rollup and the console's both call this.
 * They used to carry separate tables and had already drifted — the console valued
 * a daily price at ×30/month while the API used ×365/12.
 */
export function toMonthlyKobo(
  amountInKobo: number,
  interval: PriceInterval,
  intervalCount: number
): number {
  const monthlyPerUnit = (amountInKobo * periodsPerYear(interval)) / 12;
  return Math.round(monthlyPerUnit / Math.max(1, intervalCount));
}

/**
 * The SAME amount expressed on a different cadence, in integer kobo.
 *
 * A SUGGESTION, never a rule: the console derives the annual price from the
 * monthly one so the merchant starts from the equivalent figure instead of a
 * blank field — and then edits it (an annual price is usually a DISCOUNT, which
 * is a pricing decision, not arithmetic). Nothing in the engine calls this; a
 * `price` row is immutable and a subscription pins its `price_id`, so a derived
 * figure only ever seeds a NEW price the merchant is about to create.
 *
 * Routed through `periodsPerYear` — the same basis as `toMonthlyKobo` — so the
 * two can never drift the way the old per-consumer tables did.
 *
 * Clamped to >= 1 kobo: `prices.unit_amount` carries a `CHECK (unit_amount > 0)`,
 * and a cheap sub-daily cadence rounds to 0 on the way down (₦1/day → per-minute
 * is a fraction of a kobo). Suggesting a figure the insert would reject is worse
 * than suggesting the floor.
 */
export function convertIntervalKobo(
  amountInKobo: number,
  from: PriceInterval,
  fromCount: number,
  to: PriceInterval,
  toCount: number
): number {
  const annualKobo = (amountInKobo * periodsPerYear(from)) / Math.max(1, fromCount);
  const converted = (annualKobo * Math.max(1, toCount)) / periodsPerYear(to);
  return Math.max(1, Math.round(converted));
}

/**
 * The `save 17%` figure: how much cheaper a candidate cadence is than a baseline,
 * as a signed whole percent. Both inputs are ALREADY monthly-normalised — callers
 * pass `toMonthlyKobo(...)` results, so this compares like with like.
 *
 * The result is SIGNED on purpose. A cadence that costs MORE per month is a
 * premium, not a saving, and returns a negative number; clamping it to 0 would
 * quietly launder a mispriced annual plan into a neutral one. The UI decides to
 * badge only when it is > 0.
 */
export function savingsPct(baselineMonthlyKobo: number, candidateMonthlyKobo: number): number {
  if (baselineMonthlyKobo <= 0) return 0;
  return Math.round((1 - candidateMonthlyKobo / baselineMonthlyKobo) * 100);
}

/** Human cadence: `monthly`, `annual`, `every 10 minutes`. */
export function intervalLabel(interval: PriceInterval, intervalCount = 1): string {
  if (intervalCount !== 1) return `every ${intervalCount} ${interval}s`;
  switch (interval) {
    case 'minute':
      return 'every minute';
    case 'day':
      return 'daily';
    case 'week':
      return 'weekly';
    case 'month':
      return 'monthly';
    case 'year':
      return 'annual';
    default:
      return assertNever(interval, `intervalLabel: unhandled interval ${String(interval)}`);
  }
}

/** Compact price suffix: the `mo` in `₦5,000/mo`. */
export function intervalShort(interval: PriceInterval): string {
  switch (interval) {
    case 'minute':
      return 'min';
    case 'day':
      return 'day';
    case 'week':
      return 'wk';
    case 'month':
      return 'mo';
    case 'year':
      return 'yr';
    default:
      return assertNever(interval, `intervalShort: unhandled interval ${String(interval)}`);
  }
}

/**
 * Exhaustiveness guard. Widening `PriceInterval` without teaching a switch about
 * the new unit becomes a COMPILE error here instead of a silent mispricing.
 */
export function assertNever(value: never, message: string): never {
  throw new Error(`${message} (received: ${JSON.stringify(value)})`);
}
