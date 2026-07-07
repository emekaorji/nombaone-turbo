import { customersTable, invoicesTable, plansTable, pricesTable, subscriptionsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

export type InvoiceStatus = 'paid' | 'open' | 'partially_paid' | 'uncollectible' | 'void';
export type InvoiceRow = {
  reference: string;
  meta: string;
  customer: string;
  amount: string;
  status: InvoiceStatus;
  cap?: { text: string; tone: 'warning' | 'muted' };
  progress?: { pct: number; text: string };
  reason: string;
  issued: string;
  /** derived flags for segment filtering */
  overdue: boolean;
};

export type InvoicesView = {
  rows: InvoiceRow[];
  stats: { collectedKobo: number; outstandingKobo: number; overdueKobo: number; uncollectibleKobo: number };
  tabs: { key: string; label: string; count: number }[];
};

export type InvoiceSortKey = 'newest' | 'oldest' | 'amount';
/** Sort options for the list. Default = newest first (per design). */
export const INVOICE_SORTS: { key: InvoiceSortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'amount', label: 'Largest amount' },
];

const EMPTY: InvoicesView = {
  rows: [],
  stats: { collectedKobo: 0, outstandingKobo: 0, overdueKobo: 0, uncollectibleKobo: 0 },
  tabs: [
    { key: 'all', label: 'All', count: 0 },
    { key: 'open', label: 'Open', count: 0 },
    { key: 'past_due', label: 'Past due', count: 0 },
    { key: 'partially_paid', label: 'Partially paid', count: 0 },
    { key: 'paid', label: 'Paid', count: 0 },
    { key: 'uncollectible', label: 'Uncollectible', count: 0 },
  ],
};

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

type InvoiceRecord = {
  reference: string;
  periodIndex: number | null;
  billingReason: string;
  total: number;
  amountPaid: number;
  amountRemaining: number;
  dueDate: Date | null;
  finalizedAt: Date | null;
  voidedAt: Date | null;
  paidAt: Date | null;
  uncollectibleAt: Date | null;
  createdAt: Date;
  customerName: string | null;
  customerEmail: string;
  planName: string | null;
};

function statusOf(r: InvoiceRecord): InvoiceStatus {
  if (r.voidedAt) return 'void';
  if (r.uncollectibleAt) return 'uncollectible';
  if (r.paidAt || (r.finalizedAt && r.amountRemaining === 0)) return 'paid';
  if (r.finalizedAt && r.amountPaid > 0 && r.amountRemaining > 0) return 'partially_paid';
  return 'open';
}

export async function getInvoicesView(sort: InvoiceSortKey = 'newest'): Promise<InvoicesView> {
  const session = await getSession();
  if (!session) return EMPTY;

  const invoices = (await db
    .select({
      reference: invoicesTable.reference,
      periodIndex: invoicesTable.periodIndex,
      billingReason: invoicesTable.billingReason,
      total: invoicesTable.total,
      amountPaid: invoicesTable.amountPaid,
      amountRemaining: invoicesTable.amountRemaining,
      dueDate: invoicesTable.dueDate,
      finalizedAt: invoicesTable.finalizedAt,
      voidedAt: invoicesTable.voidedAt,
      paidAt: invoicesTable.paidAt,
      uncollectibleAt: invoicesTable.uncollectibleAt,
      createdAt: invoicesTable.createdAt,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      planName: plansTable.name,
    })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(subscriptionsTable, eq(invoicesTable.subscriptionId, subscriptionsTable.id))
    .leftJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .leftJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(and(eq(invoicesTable.organizationId, session.organizationId), eq(invoicesTable.mode, session.mode)))
    .orderBy(desc(invoicesTable.createdAt))) as InvoiceRecord[];

  if (invoices.length === 0) return EMPTY;

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  const stats = { collectedKobo: 0, outstandingKobo: 0, overdueKobo: 0, uncollectibleKobo: 0 };
  const count = { all: 0, open: 0, past_due: 0, partially_paid: 0, paid: 0, uncollectible: 0 };

  const built = invoices.map((r, idx) => {
    const status = statusOf(r);
    const overdue = status === 'open' && !!r.dueDate && r.dueDate < now;

    // stats
    if (r.paidAt && r.paidAt >= thirtyAgo) stats.collectedKobo += r.amountPaid;
    if (status === 'open' || status === 'partially_paid') stats.outstandingKobo += r.amountRemaining;
    if (overdue) stats.overdueKobo += r.amountRemaining;
    if (status === 'uncollectible') stats.uncollectibleKobo += r.amountRemaining || r.total;

    // tab counts
    count.all += 1;
    if (status === 'open') count.open += 1;
    if (overdue) count.past_due += 1;
    if (status === 'partially_paid') count.partially_paid += 1;
    if (status === 'paid') count.paid += 1;
    if (status === 'uncollectible') count.uncollectible += 1;

    const meta =
      r.planName && r.periodIndex !== null
        ? `cycle ${r.periodIndex} · ${r.planName}`
        : r.planName
          ? r.planName
          : r.billingReason.replace(/_/g, ' ');

    let cap: InvoiceRow['cap'];
    let progress: InvoiceRow['progress'];
    if (status === 'partially_paid') {
      progress = {
        pct: r.total > 0 ? Math.round((r.amountPaid / r.total) * 100) : 0,
        text: `${naira(r.amountPaid)} of ${naira(r.total)}`,
      };
    } else if (status === 'uncollectible') {
      cap = { text: `written off ${shortDate(r.uncollectibleAt)}`, tone: 'warning' };
    } else if (status === 'open') {
      if (!r.finalizedAt) {
        cap = { text: 'draft', tone: 'muted' };
      } else if (overdue && r.dueDate) {
        cap = { text: `overdue ${daysBetween(now, r.dueDate)}d · in dunning`, tone: 'warning' };
      } else if (r.dueDate) {
        const d = daysBetween(r.dueDate, now);
        cap = { text: d <= 0 ? 'due today' : `due in ${d} day${d === 1 ? '' : 's'}`, tone: 'muted' };
      }
    }

    const row: InvoiceRow = {
      reference: r.reference,
      meta,
      customer: r.customerName ?? r.customerEmail,
      amount: naira(r.total),
      status,
      cap,
      progress,
      reason: r.billingReason,
      issued: shortDate(r.finalizedAt ?? r.createdAt),
      overdue,
    };
    return { row, total: r.total, idx };
  });

  // `invoices` arrives createdAt-desc, so `idx` preserves "newest first".
  const sorted = [...built].sort((a, b) => {
    if (sort === 'oldest') return b.idx - a.idx;
    if (sort === 'amount') return b.total - a.total || a.idx - b.idx;
    return a.idx - b.idx; // newest
  });
  const rows: InvoiceRow[] = sorted.map((x) => x.row);

  return {
    rows,
    stats,
    tabs: [
      { key: 'all', label: 'All', count: count.all },
      { key: 'open', label: 'Open', count: count.open },
      { key: 'past_due', label: 'Past due', count: count.past_due },
      { key: 'partially_paid', label: 'Partially paid', count: count.partially_paid },
      { key: 'paid', label: 'Paid', count: count.paid },
      { key: 'uncollectible', label: 'Uncollectible', count: count.uncollectible },
    ],
  };
}

export { nairaShort };
