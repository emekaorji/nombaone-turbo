import { plansTable, pricesTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

export type PlanStatus = 'active' | 'archived';

export type PlanCard = {
  reference: string;
  name: string;
  status: PlanStatus;
  pricesCount: number;
  subscribers: number;
  mrr: string;
  selected: boolean;
};

export type PriceRow = {
  reference: string;
  amount: string;
  interval: string;
  type: string;
  subscribers: number;
  active: boolean;
};

export type PlanDetail = {
  reference: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  subscribers: number;
  mrr: string;
  pricesCount: number;
  billing: string;
  prices: PriceRow[];
};

export type PlansView = { cards: PlanCard[]; detail: PlanDetail | null };

const intervalLabel = (interval: string, count: number): string => {
  if (count === 1) return interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : `every ${interval}`;
  return `every ${count} ${interval}s`;
};

/** Plans + their immutable price ladder, scoped to org+mode. `selectedRef` picks the detail pane (defaults to newest). */
export async function listPlans(selectedRef?: string): Promise<PlansView> {
  const session = await getSession();
  if (!session) return { cards: [], detail: null };
  const { organizationId, mode } = session;

  const [plans, prices] = await Promise.all([
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
  ]);

  const pricesByPlan = new Map<string, typeof prices>();
  for (const p of prices) {
    const arr = pricesByPlan.get(p.planId) ?? [];
    arr.push(p);
    pricesByPlan.set(p.planId, arr);
  }

  // Subscriber counts / MRR need the subscription_items join (built with the
  // subscriptions surface). With no subscriptions they are honestly 0 / ₦0.
  const cards: PlanCard[] = plans.map((pl) => ({
    reference: pl.reference,
    name: pl.name,
    status: pl.status,
    pricesCount: (pricesByPlan.get(pl.id) ?? []).length,
    subscribers: 0,
    mrr: nairaShort(0),
    selected: false,
  }));

  const selectedPlan = plans.find((p) => p.reference === selectedRef) ?? plans[0];
  if (!selectedPlan) return { cards, detail: null };
  for (const c of cards) c.selected = c.reference === selectedPlan.reference;

  const selPrices = (pricesByPlan.get(selectedPlan.id) ?? [])
    .slice()
    .sort((a, b) => Number(b.active) - Number(a.active));
  const activePrice = selPrices.find((p) => p.active);

  const detail: PlanDetail = {
    reference: selectedPlan.reference,
    name: selectedPlan.name,
    description: selectedPlan.description ?? null,
    status: selectedPlan.status,
    subscribers: 0,
    mrr: nairaShort(0),
    pricesCount: selPrices.length,
    billing: activePrice ? activePrice.usageType : '—',
    prices: selPrices.map((p) => ({
      reference: p.reference,
      amount: naira(Number(p.unitAmount)),
      interval: intervalLabel(p.interval, p.intervalCount),
      type: `${p.usageType} · ${p.billingScheme}`,
      subscribers: 0,
      active: p.active,
    })),
  };

  return { cards, detail };
}
