import { toMonthlyKobo } from '@nombaone/core-contracts/billing';
import {
  customersTable,
  invoicesTable,
  paymentMethodsTable,
  plansTable,
  pricesTable,
  subscriptionsTable,
} from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

import type { Cycle } from '@/components/console/health-strip';
import type { Rail } from '@/components/console/rail-badge';
import type { SubStatus } from '@/components/console/status-badge';

export type Recovery = { text: string; sub: string; action: string; tone: 'info' | 'warning' };
export type SubRow = {
  reference: string;
  name: string;
  cus: string;
  plan: string;
  mrr: string;
  health: Cycle[];
  rail: Rail | null;
  status: SubStatus;
  recovery?: Recovery;
  renews?: { label: string; tone?: 'info' };
};

export type SubSortKey = 'at_risk' | 'mrr' | 'renewing' | 'newest';
/** Sort options for the list. Default = revenue at risk, so the leaking money leads (per design). */
export const SUB_SORTS: { key: SubSortKey; label: string }[] = [
  { key: 'at_risk', label: 'Revenue at risk' },
  { key: 'mrr', label: 'MRR' },
  { key: 'renewing', label: 'Renewing soon' },
  { key: 'newest', label: 'Newest' },
];

export type BookSegment = { key: 'clean' | 'recovery' | 'past_due' | 'churned'; count: number };
export type SubscriptionsView = {
  rows: SubRow[];
  metrics: {
    mrrKobo: number;
    mrrShort: string;
    atRiskKobo: number;
    atRiskShort: string;
    total: number;
    activeCount: number;
    trialingCount: number;
    pastDueCount: number;
    segments: BookSegment[];
    tabs: { key: string; label: string; count: number }[];
  };
};

const EMPTY: SubscriptionsView = {
  rows: [],
  metrics: {
    mrrKobo: 0,
    mrrShort: nairaShort(0),
    atRiskKobo: 0,
    atRiskShort: nairaShort(0),
    total: 0,
    activeCount: 0,
    trialingCount: 0,
    pastDueCount: 0,
    segments: [
      { key: 'clean', count: 0 },
      { key: 'recovery', count: 0 },
      { key: 'past_due', count: 0 },
      { key: 'churned', count: 0 },
    ],
    tabs: [
      { key: 'all', label: 'All', count: 0 },
      { key: 'recovery', label: 'In recovery', count: 0 },
      { key: 'churn', label: 'Churn risk', count: 0 },
      { key: 'trialing', label: 'Trialing', count: 0 },
      { key: 'paused', label: 'Paused', count: 0 },
      { key: 'canceled', label: 'Canceled', count: 0 },
    ],
  },
};

const RAIL_BY_KIND: Record<string, Rail> = {
  card: 'card',
  mandate: 'ddebit',
  virtual_account: 'transfer',
};

function toSubStatus(s: string): SubStatus {
  switch (s) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'paused':
    case 'canceled':
      return s;
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    default:
      return 'active';
  }
}

/** Invoice → per-cycle outcome, derived from money state (invoices carry no status column). */
type InvoiceOutcome = { periodIndex: number | null; cycle: Cycle };
function outcomeOf(row: {
  finalizedAt: Date | null;
  voidedAt: Date | null;
  paidAt: Date | null;
  amountRemaining: number;
}): Cycle {
  if (row.paidAt) return 'paid';
  if (row.voidedAt) return 'upcoming';
  if (row.finalizedAt && row.amountRemaining > 0) return 'failed';
  return 'upcoming';
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

function renewLabel(days: number | null): string {
  if (days === null) return 'Renewal date pending';
  if (days < 0) return 'Renewal overdue';
  if (days === 0) return 'Renews today';
  if (days === 1) return 'Renews tomorrow';
  return `Renews in ${days} days`;
}

export async function getSubscriptionsView(sort: SubSortKey = 'at_risk'): Promise<SubscriptionsView> {
  const session = await getSession();
  if (!session) return EMPTY;

  const subs = await db
    .select({
      id: subscriptionsTable.id,
      reference: subscriptionsTable.reference,
      status: subscriptionsTable.status,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      trialEnd: subscriptionsTable.trialEnd,
      unitAmount: pricesTable.unitAmount,
      interval: pricesTable.interval,
      intervalCount: pricesTable.intervalCount,
      planName: plansTable.name,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      customerRef: customersTable.reference,
      pmKind: paymentMethodsTable.kind,
    })
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .leftJoin(paymentMethodsTable, eq(subscriptionsTable.defaultPaymentMethodId, paymentMethodsTable.id))
    .where(and(eq(subscriptionsTable.organizationId, session.organizationId), eq(subscriptionsTable.mode, session.mode)))
    .orderBy(desc(subscriptionsTable.createdAt));

  if (subs.length === 0) return EMPTY;

  // One batched pass over this org's subscription invoices → per-sub cycle history.
  const invoices = await db
    .select({
      subscriptionId: invoicesTable.subscriptionId,
      periodIndex: invoicesTable.periodIndex,
      amountDue: invoicesTable.amountDue,
      amountRemaining: invoicesTable.amountRemaining,
      finalizedAt: invoicesTable.finalizedAt,
      voidedAt: invoicesTable.voidedAt,
      paidAt: invoicesTable.paidAt,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, session.organizationId),
        eq(invoicesTable.mode, session.mode),
        isNotNull(invoicesTable.subscriptionId),
        inArray(
          invoicesTable.subscriptionId,
          subs.map((s) => s.id),
        ),
      ),
    )
    .orderBy(invoicesTable.periodIndex);

  const historyBySub = new Map<string, InvoiceOutcome[]>();
  const dueBySub = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.subscriptionId) continue;
    const list = historyBySub.get(inv.subscriptionId) ?? [];
    list.push({ periodIndex: inv.periodIndex, cycle: outcomeOf(inv) });
    historyBySub.set(inv.subscriptionId, list);
    if (inv.finalizedAt && !inv.paidAt && !inv.voidedAt && inv.amountRemaining > 0) {
      dueBySub.set(inv.subscriptionId, (dueBySub.get(inv.subscriptionId) ?? 0) + inv.amountRemaining);
    }
  }

  function healthOf(subId: string, status: string, trialEnd: Date | null): Cycle[] {
    const hist = (historyBySub.get(subId) ?? []).slice(-6).map((h) => h.cycle);
    if (hist.length === 0 && status === 'trialing') {
      return ['trial', 'trial', 'upcoming', 'upcoming', 'upcoming', 'upcoming'];
    }
    // Pad the recent window to six cells with neutral upcoming cells (honest: not yet billed).
    while (hist.length < 6) hist.push('upcoming');
    void trialEnd;
    return hist;
  }

  let mrrKobo = 0;
  let atRiskKobo = 0;
  const seg = { clean: 0, recovery: 0, past_due: 0, churned: 0 };
  const tabCount = { all: 0, recovery: 0, churn: 0, trialing: 0, paused: 0, canceled: 0 };
  let activeCount = 0;

  const built = subs.map((s, idx) => {
    const mk = toMonthlyKobo(s.unitAmount, s.interval, s.intervalCount);
    const status = toSubStatus(s.status);
    const rail = s.pmKind ? (RAIL_BY_KIND[s.pmKind] ?? null) : null;
    const due = dueBySub.get(s.id) ?? 0;

    // Book composition + segment counters.
    tabCount.all += 1;
    if (status === 'active') {
      mrrKobo += mk;
      seg.clean += 1;
      activeCount += 1;
    } else if (status === 'trialing') {
      seg.clean += 1;
      tabCount.trialing += 1;
    } else if (status === 'past_due') {
      atRiskKobo += due || mk;
      seg.past_due += 1;
      seg.recovery += 1;
      tabCount.recovery += 1;
      tabCount.churn += 1;
    } else if (status === 'paused') {
      tabCount.paused += 1;
    } else if (status === 'canceled') {
      seg.churned += 1;
      tabCount.canceled += 1;
    }

    const recovery: Recovery | undefined =
      status === 'past_due'
        ? {
            text: `Payment due · ${naira(due || mk)}`,
            sub: 'Recovery runs in the billing engine',
            action: 'Recover',
            tone: 'warning',
          }
        : undefined;

    const renews =
      status === 'trialing'
        ? { label: (() => { const d = daysUntil(s.trialEnd); return d === null ? 'Trial ending' : d <= 0 ? 'Trial ended' : `Trial ends in ${d} days`; })(), tone: 'info' as const }
        : status === 'active'
          ? { label: renewLabel(daysUntil(s.currentPeriodEnd)) }
          : undefined;

    const row: SubRow = {
      reference: s.reference,
      name: s.customerName ?? s.customerEmail,
      cus: s.customerRef,
      plan: s.planName,
      mrr: naira(mk),
      health: healthOf(s.id, s.status, s.trialEnd),
      rail,
      status,
      recovery,
      renews,
    };
    return { row, mrrKobo: mk, atRiskKobo: status === 'past_due' ? due || mk : 0, periodEnd: s.currentPeriodEnd, idx };
  });

  // Sort per the chosen key. `subs` arrives createdAt-desc, so `idx` preserves "newest".
  const sorted = [...built].sort((a, b) => {
    if (sort === 'mrr') return b.mrrKobo - a.mrrKobo || a.idx - b.idx;
    if (sort === 'renewing') return (a.periodEnd?.getTime() ?? Infinity) - (b.periodEnd?.getTime() ?? Infinity) || a.idx - b.idx;
    if (sort === 'newest') return a.idx - b.idx;
    // at_risk (default): leaking money first, then largest MRR.
    return b.atRiskKobo - a.atRiskKobo || b.mrrKobo - a.mrrKobo || a.idx - b.idx;
  });
  const rows: SubRow[] = sorted.map((x) => x.row);

  return {
    rows,
    metrics: {
      mrrKobo,
      mrrShort: nairaShort(mrrKobo),
      atRiskKobo,
      atRiskShort: nairaShort(atRiskKobo),
      total: rows.length,
      activeCount,
      trialingCount: tabCount.trialing,
      pastDueCount: tabCount.recovery,
      segments: [
        { key: 'clean', count: seg.clean },
        { key: 'recovery', count: seg.recovery },
        { key: 'past_due', count: seg.past_due },
        { key: 'churned', count: seg.churned },
      ],
      tabs: [
        { key: 'all', label: 'All', count: tabCount.all },
        { key: 'recovery', label: 'In recovery', count: tabCount.recovery },
        { key: 'churn', label: 'Churn risk', count: tabCount.churn },
        { key: 'trialing', label: 'Trialing', count: tabCount.trialing },
        { key: 'paused', label: 'Paused', count: tabCount.paused },
        { key: 'canceled', label: 'Canceled', count: tabCount.canceled },
      ],
    },
  };
}
