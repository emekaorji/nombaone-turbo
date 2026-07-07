import {
  customersTable,
  domainEventsTable,
  dunningAttemptsTable,
  invoicesTable,
  paymentMethodsTable,
  plansTable,
  pricesTable,
  subscriptionSchedulesTable,
  subscriptionsTable,
} from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { ApiError, callApi } from '@/lib/api-client';
import { getSession } from '@/lib/auth';
import { naira } from '@/lib/money';
import type { SubStatus } from '@/components/console/status-badge';

type UpcomingInvoice = {
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  subtotalInKobo: number;
  totalInKobo: number;
  amountDueInKobo: number;
};

export type TimelineTone = 'neutral' | 'success' | 'danger' | 'warning' | 'upcoming';
export type TimelineNode = { type: string; meta: string; time: string; tone: TimelineTone };
export type AttemptLogRow = { title: string; sub: string; time: string; ok: boolean };

export type SubscriptionDetail = {
  reference: string;
  customerName: string;
  status: SubStatus;
  headline: string;
  railLabel: string;
  details: { label: string; value: string; tone?: 'warning' }[];
  recovery: {
    active: boolean;
    attemptLabel: string;
    info: { label: string; value: string; tone: 'default' | 'warning' }[];
    log: AttemptLogRow[];
  };
  timeline: TimelineNode[];
  upcoming: { periodLabel: string; lines: { label: string; value: string; strong?: boolean }[] };
  scheduledChanges: { label: string; effective: string }[];
  methods: { reference: string; label: string }[];
  mrr: string;
};

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function dateTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toStatus(s: string): SubStatus {
  if (['active', 'trialing', 'past_due', 'paused', 'canceled'].includes(s)) return s as SubStatus;
  return 'incomplete';
}
function railLabelOf(kind: string | null, brand: string | null, last4: string | null): string {
  if (!kind) return 'No method';
  if (kind === 'card') return `Card ${brand ? `${brand} ` : ''}·${last4 ?? '••••'}`;
  if (kind === 'mandate') return 'Direct debit · NIBSS';
  return 'Bank transfer · virtual account';
}
function eventTone(type: string): TimelineTone {
  if (/succeeded|recovered|paid|activated/.test(type)) return 'success';
  if (/failed|uncollectible|exhausted|canceled/.test(type)) return 'danger';
  if (/dunning|scheduled|attempt|action_required|past_due/.test(type)) return 'warning';
  if (/upcoming/.test(type)) return 'upcoming';
  return 'neutral';
}

export async function getSubscriptionDetail(reference: string): Promise<SubscriptionDetail | null> {
  const session = await getSession();
  if (!session) return null;

  const [sub] = await db
    .select({
      id: subscriptionsTable.id,
      reference: subscriptionsTable.reference,
      status: subscriptionsTable.status,
      collectionMethod: subscriptionsTable.collectionMethod,
      currentPeriodStart: subscriptionsTable.currentPeriodStart,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      createdAt: subscriptionsTable.createdAt,
      unitAmount: pricesTable.unitAmount,
      interval: pricesTable.interval,
      planName: plansTable.name,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      pmKind: paymentMethodsTable.kind,
      pmBrand: paymentMethodsTable.brand,
      pmLast4: paymentMethodsTable.last4,
    })
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .leftJoin(paymentMethodsTable, eq(subscriptionsTable.defaultPaymentMethodId, paymentMethodsTable.id))
    .where(
      and(
        eq(subscriptionsTable.organizationId, session.organizationId),
        eq(subscriptionsTable.mode, session.mode),
        eq(subscriptionsTable.reference, reference),
      ),
    );

  if (!sub) return null;

  const status = toStatus(sub.status);
  const railLabel = railLabelOf(sub.pmKind, sub.pmBrand, sub.pmLast4);
  const customerName = sub.customerName ?? sub.customerEmail;
  const intervalLabel = sub.interval === 'month' ? 'mo' : sub.interval;

  // Dunning attempts for this subscription (append-only), newest first.
  const attempts = await db
    .select({
      attemptNumber: dunningAttemptsTable.attemptNumber,
      status: dunningAttemptsTable.status,
      branch: dunningAttemptsTable.branch,
      failureReason: dunningAttemptsTable.failureReason,
      nextAttemptAt: dunningAttemptsTable.nextAttemptAt,
      scheduledAt: dunningAttemptsTable.scheduledAt,
      createdAt: dunningAttemptsTable.createdAt,
    })
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, session.organizationId),
        eq(dunningAttemptsTable.mode, session.mode),
        eq(dunningAttemptsTable.subscriptionId, sub.id),
      ),
    )
    .orderBy(desc(dunningAttemptsTable.attemptNumber));

  const latest = attempts[0];
  const recoveryActive = status === 'past_due' && !!latest;
  const branchLabel = latest
    ? latest.branch === 'card_update_required'
      ? 'card update · customer action'
      : latest.branch === 'short_path'
        ? 'short path · final attempts'
        : 'reschedule · payday-timed'
    : '—';

  const recovery = {
    active: recoveryActive,
    attemptLabel: latest ? `Attempt ${latest.attemptNumber}` : 'Not in recovery',
    info: [
      { label: 'Branch', value: branchLabel, tone: 'default' as const },
      { label: 'Next attempt', value: latest?.nextAttemptAt ? dateTime(latest.nextAttemptAt) : '—', tone: 'default' as const },
      {
        label: 'Grace access',
        value: latest?.nextAttemptAt ? `until ${dateTime(latest.nextAttemptAt)}` : '—',
        tone: 'warning' as const,
      },
    ],
    log: attempts.map((a) => ({
      title: `Attempt ${a.attemptNumber} · ${a.status}`,
      sub: a.failureReason ? `${a.failureReason} · ${a.branch}` : `Branch: ${a.branch}`,
      time: shortDate(a.createdAt),
      ok: a.status === 'scheduled' || a.status === 'rescheduled',
    })),
  };

  // Timeline from the domain-event log for this sub + its invoices.
  const subInvoices = await db
    .select({ reference: invoicesTable.reference })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, session.organizationId),
        eq(invoicesTable.mode, session.mode),
        eq(invoicesTable.subscriptionId, sub.id),
      ),
    );
  const refs = new Set<string>([sub.reference, ...subInvoices.map((i) => i.reference)]);

  const events = await db
    .select({ type: domainEventsTable.type, payload: domainEventsTable.payload, createdAt: domainEventsTable.createdAt })
    .from(domainEventsTable)
    .where(and(eq(domainEventsTable.organizationId, session.organizationId), eq(domainEventsTable.mode, session.mode)))
    .orderBy(desc(domainEventsTable.createdAt))
    .limit(200);

  const timeline: TimelineNode[] = events
    .filter((e) => {
      const s = JSON.stringify(e.payload);
      for (const r of refs) if (s.includes(r)) return true;
      return false;
    })
    .reverse()
    .map((e) => ({
      type: e.type,
      meta: shortDate(e.createdAt),
      time: shortDate(e.createdAt),
      tone: eventTone(e.type),
    }));

  const details: SubscriptionDetail['details'] = [
    {
      label: 'Status',
      value: status.replace('_', ' '),
      ...(status === 'past_due' ? { tone: 'warning' as const } : {}),
    },
    { label: 'Customer', value: customerName },
    { label: 'Price', value: `${sub.planName} · ${naira(sub.unitAmount)}/${intervalLabel}` },
    { label: 'Rail', value: railLabel },
    { label: 'Collection', value: sub.collectionMethod === 'charge_automatically' ? 'Automatic' : 'Send invoice' },
    {
      label: 'Current period',
      value:
        sub.currentPeriodStart && sub.currentPeriodEnd
          ? `${shortDate(sub.currentPeriodStart)} → ${shortDate(sub.currentPeriodEnd)}`
          : '—',
    },
    { label: 'Started', value: shortDate(sub.createdAt) },
  ];

  // Scheduled next-cycle changes (active schedules with unconsumed phases).
  const schedules = await db
    .select({ phases: subscriptionSchedulesTable.phases })
    .from(subscriptionSchedulesTable)
    .where(
      and(
        eq(subscriptionSchedulesTable.organizationId, session.organizationId),
        eq(subscriptionSchedulesTable.mode, session.mode),
        eq(subscriptionSchedulesTable.subscriptionId, sub.id),
        eq(subscriptionSchedulesTable.status, 'active'),
      ),
    );
  const pendingPhases = schedules.flatMap((s) => s.phases).filter((p) => !p.consumedAt);
  const phasePriceIds = [...new Set(pendingPhases.map((p) => p.priceId))];
  const priceLabels = new Map<string, string>();
  if (phasePriceIds.length > 0) {
    const priceRows = await db
      .select({ id: pricesTable.id, unitAmount: pricesTable.unitAmount, interval: pricesTable.interval, planName: plansTable.name })
      .from(pricesTable)
      .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
      .where(inArray(pricesTable.id, phasePriceIds));
    for (const p of priceRows) priceLabels.set(p.id, `${p.planName} · ${naira(p.unitAmount)}/${p.interval === 'month' ? 'mo' : p.interval}`);
  }
  const scheduledChanges = pendingPhases.map((p) => ({
    label: `Switch to ${priceLabels.get(p.priceId) ?? 'another price'}${p.quantity && p.quantity > 1 ? ` ×${p.quantity}` : ''}`,
    effective: `at period ${p.startIndex}`,
  }));

  // The customer's active methods — for the "Change payment method" action.
  const methodRows = await db
    .select({ reference: paymentMethodsTable.reference, kind: paymentMethodsTable.kind, brand: paymentMethodsTable.brand, last4: paymentMethodsTable.last4 })
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.organizationId, session.organizationId),
        eq(paymentMethodsTable.mode, session.mode),
        eq(paymentMethodsTable.customerId, sub.customerId),
        eq(paymentMethodsTable.status, 'active'),
      ),
    );
  const methods = methodRows.map((m) => ({
    reference: m.reference,
    label: m.kind === 'card' ? `${m.brand ?? 'Card'} ·${m.last4 ?? '••••'}` : m.kind === 'mandate' ? 'Direct debit' : 'Bank transfer',
  }));

  // Upcoming-invoice preview — the engine computes it (proration/discounts/credits);
  // best-effort, falls back to a plain price calc if the API is unreachable.
  let upcoming: SubscriptionDetail['upcoming'] = {
    periodLabel: sub.currentPeriodEnd ? `next · ${shortDate(sub.currentPeriodEnd)}` : 'next cycle',
    lines: [
      { label: 'Subtotal', value: naira(sub.unitAmount) },
      { label: 'Proration', value: naira(0) },
      { label: 'Amount due', value: naira(sub.unitAmount), strong: true },
    ],
  };
  if (status === 'active' || status === 'trialing') {
    try {
      const up = await callApi<UpcomingInvoice>(session, `/subscriptions/${encodeURIComponent(sub.reference)}/upcoming-invoice`, { method: 'GET' });
      const adjustment = up.totalInKobo - up.subtotalInKobo;
      upcoming = {
        periodLabel: `#${up.periodIndex} · ${shortDate(new Date(up.periodStart))} → ${shortDate(new Date(up.periodEnd))}`,
        lines: [
          { label: 'Subtotal', value: naira(up.subtotalInKobo) },
          ...(adjustment !== 0 ? [{ label: adjustment < 0 ? 'Discounts & credits' : 'Adjustments', value: naira(adjustment) }] : []),
          { label: 'Amount due', value: naira(up.amountDueInKobo), strong: true },
        ],
      };
    } catch (e) {
      void (e instanceof ApiError); // keep the static fallback
    }
  }

  return {
    reference: sub.reference,
    customerName,
    status,
    headline: `${sub.planName} · ${naira(sub.unitAmount)} / ${intervalLabel} · ${
      sub.collectionMethod === 'charge_automatically' ? 'Automatic' : 'Send invoice'
    }`,
    railLabel,
    details,
    recovery,
    timeline,
    scheduledChanges,
    upcoming,
    methods,
    mrr: naira(sub.unitAmount),
  };
}
