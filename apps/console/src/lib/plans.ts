import { cadenceApproxMs, intervalLabel, intervalShort, savingsPct, toMonthlyKobo } from '@nombaone/core-contracts/billing';
import { plansTable, pricesTable, subscriptionsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

import type { PriceInterval } from '@nombaone/core-contracts/types';

export type PlanStatus = 'active' | 'archived';

export type PlanCard = {
  reference: string;
  name: string;
  status: PlanStatus;
  pricesCount: number;
  /** No ACTIVE price — the plan cannot be billed. Only legacy rows can be in this state now. */
  billable: boolean;
  /** The active ladder, one line: `₦5,000/mo · ₦50,000/yr`. Empty when the plan has no active price. */
  ladder: string;
  subscribers: number;
  mrr: string;
  selected: boolean;
};

export type PriceRow = {
  reference: string;
  /** Integer kobo — the raw figure, so the ladder can do its own math instead of parsing a string back. */
  unitAmount: number;
  interval: PriceInterval;
  intervalCount: number;
  /** `₦5,000/mo` (or `₦12,000 every 3 months` when the count is not 1 — `/mo` would lie there). */
  short: string;
  /** `monthly`, `annual`, `every 3 months`. */
  cadence: string;
  /** Signed % against the plan's baseline cadence. Negative = a premium; the UI badges only > 0. */
  savings: number;
  type: string;
  subscribers: number;
  active: boolean;
};

export type PlanDetail = {
  reference: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  billable: boolean;
  ladder: string;
  subscribers: number;
  mrr: string;
  pricesCount: number;
  billing: string;
  prices: PriceRow[];
};

export type PlansView = { cards: PlanCard[]; detail: PlanDetail | null };

/**
 * A LIVE subscription — the customer is on the plan right now, so they count as a subscriber.
 * MRR is narrower: `active` only, matching the customers surface (a trial pays nothing yet, and a
 * past_due has not paid). Counting either of those as revenue would overstate the plan.
 */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Cadence order for the ladder: shortest → longest, by real duration.
 *
 * NOT by `PRICE_INTERVALS.indexOf` — that list is pinned to the Postgres enum's physical order,
 * which is append-only, so `minute` sits at the END of it and "every 10 minutes" would print
 * after "annual". Duration is what a merchant reads a ladder by.
 */
const cadenceRank = (interval: PriceInterval, intervalCount: number): number =>
  cadenceApproxMs(interval, intervalCount);

/** `₦5,000/mo`. A count of 1 gets the compact suffix; anything else must spell the cadence out. */
function priceShort(unitAmount: number, interval: PriceInterval, intervalCount: number): string {
  return intervalCount === 1
    ? `${naira(unitAmount)}/${intervalShort(interval)}`
    : `${naira(unitAmount)} ${intervalLabel(interval, intervalCount)}`;
}

/**
 * Plans + their price ladder, scoped to org+mode (the isolation invariant — every domain row carries
 * both and the app filters explicitly, because RLS is dormant). `selectedRef` picks the detail pane
 * (defaults to newest).
 *
 * Subscribers and MRR are REAL: a subscription pins one `price_id`, so the plan rollup is a single
 * join (subscriptions ⋈ prices), the same one the customers surface uses.
 */
export async function listPlans(selectedRef?: string): Promise<PlansView> {
  const session = await getSession();
  if (!session) return { cards: [], detail: null };
  const { organizationId, mode } = session;

  const [plans, prices, subs] = await Promise.all([
    db
      .select()
      .from(plansTable)
      .where(and(eq(plansTable.organizationId, organizationId), eq(plansTable.mode, mode)))
      .orderBy(desc(plansTable.createdAt)),
    db
      .select()
      .from(pricesTable)
      .where(and(eq(pricesTable.organizationId, organizationId), eq(pricesTable.mode, mode)))
      .orderBy(desc(pricesTable.createdAt)),
    db
      .select({
        priceId: subscriptionsTable.priceId,
        planId: pricesTable.planId,
        status: subscriptionsTable.status,
        unitAmount: pricesTable.unitAmount,
        interval: pricesTable.interval,
        intervalCount: pricesTable.intervalCount,
      })
      .from(subscriptionsTable)
      .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
      .where(and(eq(subscriptionsTable.organizationId, organizationId), eq(subscriptionsTable.mode, mode))),
  ]);

  const pricesByPlan = new Map<string, typeof prices>();
  for (const p of prices) {
    const arr = pricesByPlan.get(p.planId) ?? [];
    arr.push(p);
    pricesByPlan.set(p.planId, arr);
  }

  const subsByPrice = new Map<string, number>();
  const subsByPlan = new Map<string, number>();
  const mrrByPlan = new Map<string, number>();
  for (const s of subs) {
    if (LIVE_STATUSES.has(s.status)) {
      subsByPrice.set(s.priceId, (subsByPrice.get(s.priceId) ?? 0) + 1);
      subsByPlan.set(s.planId, (subsByPlan.get(s.planId) ?? 0) + 1);
    }
    if (s.status === 'active') {
      const monthly = toMonthlyKobo(s.unitAmount, s.interval, s.intervalCount);
      mrrByPlan.set(s.planId, (mrrByPlan.get(s.planId) ?? 0) + monthly);
    }
  }

  /**
   * The baseline every other cadence is measured against: the cadence that costs the MOST per month.
   * That is the shortest one a customer can buy (₦5,000/mo beats ₦50,000/yr on sticker price and
   * loses on the year), which is exactly the figure "save 17%" is a saving against.
   */
  const baselineMonthly = (planPrices: typeof prices): number =>
    planPrices
      .filter((p) => p.active)
      .reduce((max, p) => Math.max(max, toMonthlyKobo(p.unitAmount, p.interval, p.intervalCount)), 0);

  /** Active prices, cadence-ordered, as one line: `₦5,000/mo · ₦50,000/yr — save 17%`. */
  function ladderLine(planPrices: typeof prices): string {
    const active = planPrices
      .filter((p) => p.active)
      .sort((a, b) => cadenceRank(a.interval, a.intervalCount) - cadenceRank(b.interval, b.intervalCount));
    if (active.length === 0) return '';
    const baseline = baselineMonthly(planPrices);
    const best = active.reduce(
      (max, p) => Math.max(max, savingsPct(baseline, toMonthlyKobo(p.unitAmount, p.interval, p.intervalCount))),
      0,
    );
    const line = active.map((p) => priceShort(p.unitAmount, p.interval, p.intervalCount)).join(' · ');
    return best > 0 ? `${line} — save ${best}%` : line;
  }

  const cards: PlanCard[] = plans.map((pl) => {
    const planPrices = pricesByPlan.get(pl.id) ?? [];
    return {
      reference: pl.reference,
      name: pl.name,
      status: pl.status,
      pricesCount: planPrices.length,
      billable: planPrices.some((p) => p.active),
      ladder: ladderLine(planPrices),
      subscribers: subsByPlan.get(pl.id) ?? 0,
      mrr: nairaShort(mrrByPlan.get(pl.id) ?? 0),
      selected: false,
    };
  });

  const selectedPlan = plans.find((p) => p.reference === selectedRef) ?? plans[0];
  if (!selectedPlan) return { cards, detail: null };
  for (const c of cards) c.selected = c.reference === selectedPlan.reference;

  const selPrices = pricesByPlan.get(selectedPlan.id) ?? [];
  // The ladder: active first, then shortest cadence → longest (every 10 minutes → annual).
  const ordered = selPrices
    .slice()
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        cadenceRank(a.interval, a.intervalCount) - cadenceRank(b.interval, b.intervalCount),
    );
  const baseline = baselineMonthly(selPrices);
  const activePrice = ordered.find((p) => p.active);

  const detail: PlanDetail = {
    reference: selectedPlan.reference,
    name: selectedPlan.name,
    description: selectedPlan.description ?? null,
    status: selectedPlan.status,
    billable: ordered.some((p) => p.active),
    ladder: ladderLine(selPrices),
    subscribers: subsByPlan.get(selectedPlan.id) ?? 0,
    mrr: nairaShort(mrrByPlan.get(selectedPlan.id) ?? 0),
    pricesCount: ordered.length,
    billing: activePrice ? activePrice.usageType : '—',
    prices: ordered.map((p) => ({
      reference: p.reference,
      unitAmount: p.unitAmount,
      interval: p.interval,
      intervalCount: p.intervalCount,
      short: priceShort(p.unitAmount, p.interval, p.intervalCount),
      cadence: intervalLabel(p.interval, p.intervalCount),
      savings: p.active ? savingsPct(baseline, toMonthlyKobo(p.unitAmount, p.interval, p.intervalCount)) : 0,
      type: `${p.usageType} · ${p.billingScheme}`,
      subscribers: subsByPrice.get(p.id) ?? 0,
      active: p.active,
    })),
  };

  return { cards, detail };
}
