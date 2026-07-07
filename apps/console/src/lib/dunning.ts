import {
  customersTable,
  dunningAttemptsTable,
  invoicesTable,
  orgBillingSettingsTable,
  plansTable,
  pricesTable,
  subscriptionsTable,
} from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

export type Branch = 'card_update' | 'reschedule' | 'short_path';
export type WorkRow = {
  reference: string;
  subscriptionReference: string;
  name: string;
  plan: string;
  atRiskKobo: number;
  atRisk: string;
  branch: Branch;
  attempt: string;
  next: string;
  grace: string;
  graceTone: 'warning' | 'danger' | 'muted';
  action: string;
};

export type DunningView = {
  kpis: {
    recoveryRate: string;
    recoveryRateTone: 'success' | 'muted';
    recoveredShort: string;
    recoveredCount: number;
    atRiskShort: string;
    inRecovery: number;
  };
  funnel: { key: string; label: string; value: number; tone: 'neutral' | 'success' | 'danger' }[];
  railRecovery: { name: string; amount: string; pct: number; c: string }[];
  worklist: WorkRow[];
  hasActivity: boolean;
};

const EMPTY: DunningView = {
  kpis: {
    recoveryRate: '—',
    recoveryRateTone: 'muted',
    recoveredShort: nairaShort(0),
    recoveredCount: 0,
    atRiskShort: nairaShort(0),
    inRecovery: 0,
  },
  funnel: [
    { key: 'scheduled', label: 'scheduled', value: 0, tone: 'neutral' },
    { key: 'attempting', label: 'attempting', value: 0, tone: 'neutral' },
    { key: 'card_update', label: 'card update', value: 0, tone: 'neutral' },
    { key: 'rescheduled', label: 'rescheduled', value: 0, tone: 'neutral' },
    { key: 'recovered', label: 'recovered', value: 0, tone: 'success' },
    { key: 'exhausted', label: 'exhausted', value: 0, tone: 'danger' },
  ],
  railRecovery: [
    { name: 'Card', amount: nairaShort(0), pct: 0, c: 'bg-accent' },
    { name: 'Direct debit', amount: nairaShort(0), pct: 0, c: 'bg-success' },
    { name: 'Bank transfer', amount: nairaShort(0), pct: 0, c: 'bg-info' },
  ],
  worklist: [],
  hasActivity: false,
};

const BRANCH_MAP: Record<string, Branch> = {
  card_update_required: 'card_update',
  reschedule: 'reschedule',
  short_path: 'short_path',
};
const ACTION: Record<Branch, string> = {
  card_update: 'Copy link',
  reschedule: 'Update mandate',
  short_path: 'Send link',
};
const ACTIVE = new Set(['scheduled', 'attempting', 'rescheduled', 'card_update_required']);

function railBucket(railKey: string | null): 'card' | 'ddebit' | 'transfer' {
  const k = (railKey ?? '').toLowerCase();
  if (k.includes('mandate') || k.includes('debit') || k === 'ddebit') return 'ddebit';
  if (k.includes('transfer') || k.includes('virtual') || k.includes('account')) return 'transfer';
  return 'card';
}

function shortDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function graceOf(next: Date | null): string {
  if (!next) return '';
  const h = Math.round((next.getTime() - Date.now()) / 3_600_000);
  if (h <= 0) return 'due now';
  if (h < 48) return `grace ${h}h`;
  return shortDate(next);
}

export async function getDunningView(): Promise<DunningView> {
  const session = await getSession();
  if (!session) return EMPTY;

  const [settings] = await db
    .select({ maxAttempts: orgBillingSettingsTable.dunningMaxAttempts })
    .from(orgBillingSettingsTable)
    .where(
      and(
        eq(orgBillingSettingsTable.organizationId, session.organizationId),
        eq(orgBillingSettingsTable.mode, session.mode),
      ),
    );
  const maxAttempts = settings?.maxAttempts ?? 4;

  const attempts = await db
    .select({
      reference: dunningAttemptsTable.reference,
      subscriptionReference: subscriptionsTable.reference,
      invoiceId: dunningAttemptsTable.invoiceId,
      attemptNumber: dunningAttemptsTable.attemptNumber,
      status: dunningAttemptsTable.status,
      branch: dunningAttemptsTable.branch,
      railKey: dunningAttemptsTable.railKey,
      nextAttemptAt: dunningAttemptsTable.nextAttemptAt,
      amountRemaining: invoicesTable.amountRemaining,
      amountPaid: invoicesTable.amountPaid,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      planName: plansTable.name,
    })
    .from(dunningAttemptsTable)
    .innerJoin(invoicesTable, eq(dunningAttemptsTable.invoiceId, invoicesTable.id))
    .innerJoin(subscriptionsTable, eq(dunningAttemptsTable.subscriptionId, subscriptionsTable.id))
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .leftJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .leftJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, session.organizationId),
        eq(dunningAttemptsTable.mode, session.mode),
      ),
    )
    .orderBy(desc(dunningAttemptsTable.attemptNumber));

  if (attempts.length === 0) return EMPTY;

  // Reduce append-only log → latest attempt per invoice (highest attemptNumber; already sorted desc).
  const latestByInvoice = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (!latestByInvoice.has(a.invoiceId)) latestByInvoice.set(a.invoiceId, a);
  }
  const latest = [...latestByInvoice.values()];

  const fn = { scheduled: 0, attempting: 0, card_update: 0, rescheduled: 0, recovered: 0, exhausted: 0 };
  const railPaid = { card: 0, ddebit: 0, transfer: 0 };
  let atRiskKobo = 0;
  let recoveredKobo = 0;
  let recoveredCount = 0;

  for (const a of latest) {
    switch (a.status) {
      case 'scheduled':
        fn.scheduled += 1;
        break;
      case 'attempting':
        fn.attempting += 1;
        break;
      case 'card_update_required':
        fn.card_update += 1;
        break;
      case 'rescheduled':
        fn.rescheduled += 1;
        break;
      case 'succeeded':
        fn.recovered += 1;
        recoveredCount += 1;
        recoveredKobo += a.amountPaid;
        railPaid[railBucket(a.railKey)] += a.amountPaid;
        break;
      case 'exhausted':
        fn.exhausted += 1;
        break;
    }
    if (ACTIVE.has(a.status)) atRiskKobo += a.amountRemaining;
  }

  const terminal = fn.recovered + fn.exhausted;
  const rate = terminal > 0 ? Math.round((fn.recovered / terminal) * 1000) / 10 : null;
  const inRecovery = fn.scheduled + fn.attempting + fn.card_update + fn.rescheduled;

  const railTotal = railPaid.card + railPaid.ddebit + railPaid.transfer;
  const pct = (v: number) => (railTotal > 0 ? Math.round((v / railTotal) * 100) : 0);

  const worklist: WorkRow[] = latest
    .filter((a) => ACTIVE.has(a.status))
    .sort((x, y) => y.amountRemaining - x.amountRemaining)
    .map((a) => {
      const branch = BRANCH_MAP[a.branch] ?? 'reschedule';
      const next =
        branch === 'card_update'
          ? 'held'
          : branch === 'reschedule'
            ? 'payday'
            : branch === 'short_path'
              ? 'final'
              : shortDate(a.nextAttemptAt) || 'scheduled';
      const graceTone: WorkRow['graceTone'] = branch === 'card_update' ? 'warning' : branch === 'short_path' ? 'danger' : 'muted';
      return {
        reference: a.reference,
        subscriptionReference: a.subscriptionReference,
        name: a.customerName ?? a.customerEmail,
        plan: a.planName ?? '—',
        atRiskKobo: a.amountRemaining,
        atRisk: naira(a.amountRemaining),
        branch,
        attempt: `${a.attemptNumber} / ${maxAttempts}`,
        next,
        grace: branch === 'reschedule' ? shortDate(a.nextAttemptAt) || 'payday' : graceOf(a.nextAttemptAt),
        graceTone,
        action: ACTION[branch],
      };
    });

  return {
    kpis: {
      recoveryRate: rate === null ? '—' : `${rate}%`,
      recoveryRateTone: rate !== null && rate >= 50 ? 'success' : 'muted',
      recoveredShort: nairaShort(recoveredKobo),
      recoveredCount,
      atRiskShort: nairaShort(atRiskKobo),
      inRecovery,
    },
    funnel: [
      { key: 'scheduled', label: 'scheduled', value: fn.scheduled, tone: 'neutral' },
      { key: 'attempting', label: 'attempting', value: fn.attempting, tone: 'neutral' },
      { key: 'card_update', label: 'card update', value: fn.card_update, tone: 'neutral' },
      { key: 'rescheduled', label: 'rescheduled', value: fn.rescheduled, tone: 'neutral' },
      { key: 'recovered', label: 'recovered', value: fn.recovered, tone: 'success' },
      { key: 'exhausted', label: 'exhausted', value: fn.exhausted, tone: 'danger' },
    ],
    railRecovery: [
      { name: 'Card', amount: nairaShort(railPaid.card), pct: pct(railPaid.card), c: 'bg-accent' },
      { name: 'Direct debit', amount: nairaShort(railPaid.ddebit), pct: pct(railPaid.ddebit), c: 'bg-success' },
      { name: 'Bank transfer', amount: nairaShort(railPaid.transfer), pct: pct(railPaid.transfer), c: 'bg-info' },
    ],
    worklist,
    hasActivity: true,
  };
}
