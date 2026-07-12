/**
 * The shape of a price in a PICKER, and how a picker groups them.
 *
 * A plan is now a LADDER — a monthly price, an annual price, maybe a weekly one — so the flat
 * "one line per price" list the subscription pickers used to render turns a four-cadence plan into
 * four sibling entries that all start with the same plan name. Grouping is what keeps it readable.
 *
 * This module is PURE (no db, no session) precisely so the client components that render the
 * `<select>` can import it alongside the server modules that build the options.
 */
import { intervalLabel, intervalShort, PRICE_INTERVALS } from '@nombaone/core-contracts/billing';

import { naira } from '@/lib/money';

import type { PriceInterval } from '@nombaone/core-contracts/types';

export type PriceOption = {
  reference: string;
  /** The plan the price belongs to — the group header, not part of the option's own label. */
  planName: string;
  /** `₦5,000/mo` — the price alone; the plan name is on the group. */
  label: string;
  interval: PriceInterval;
  intervalCount: number;
};

export type PriceGroup = { planName: string; prices: PriceOption[] };

/** `₦5,000/mo`. A count of 1 gets the compact suffix; anything else must spell the cadence out. */
export function priceOptionLabel(unitAmount: number, interval: PriceInterval, intervalCount: number): string {
  return intervalCount === 1
    ? `${naira(unitAmount)}/${intervalShort(interval)}`
    : `${naira(unitAmount)} ${intervalLabel(interval, intervalCount)}`;
}

/**
 * Group a flat option list into `<optgroup>`s, plan-ordered, each plan's prices cadence-ordered
 * (day → week → month → year) so the ladder reads the same way it does on the Plans surface.
 */
export function groupPricesByPlan(prices: PriceOption[]): PriceGroup[] {
  const byPlan = new Map<string, PriceOption[]>();
  for (const p of prices) {
    const list = byPlan.get(p.planName) ?? [];
    list.push(p);
    byPlan.set(p.planName, list);
  }
  return [...byPlan.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([planName, list]) => ({
      planName,
      prices: list
        .slice()
        .sort(
          (a, b) =>
            PRICE_INTERVALS.indexOf(a.interval) - PRICE_INTERVALS.indexOf(b.interval) ||
            a.intervalCount - b.intervalCount,
        ),
    }));
}
