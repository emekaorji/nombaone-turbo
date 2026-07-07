export const dynamic = 'force-dynamic';

import Link from 'next/link';

import {
  ChevronRight,
  ArrowRight,
  CreditCard,
  ArrowLeftRight,
  CalendarClock,
  RefreshCw,
  Search,
  X,
  Landmark,
  Link2,
  type LucideIcon,
} from 'lucide-react';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { StatusBadge, type SubStatus } from '@/components/console/status-badge';
import { HealthStrip, type Cycle } from '@/components/console/health-strip';
import { RailBadge, type Rail } from '@/components/console/rail-badge';
import { TriageDrawer } from '@/components/console/triage-drawer';
import { EmptyState } from '@/components/console/empty-state';
import { ErrorState } from '@/components/console/states/error-state';
import { SubscriptionsSkeleton } from '@/components/console/states/subscriptions-skeleton';
import { NewSubscriptionFlow } from '@/components/console/new-subscription-flow';
import { SubSortControl } from '@/components/console/sub-sort-control';
import { getSession } from '@/lib/auth';
import { getSubscriptionsView, SUB_SORTS, type SubRow, type SubSortKey } from '@/lib/subscriptions';
import { getSubscriptionDetail } from '@/lib/subscription-detail';
import { getNewSubscriptionData } from '@/lib/subscription-form';

const COLS = 'w-[120px]';

/* ── mobile (Z8CIJ) helpers ── */
const cycleColor: Record<Cycle, string> = {
  paid: 'bg-success',
  recovered: 'bg-accent',
  failed: 'bg-danger',
  upcoming: 'bg-surface-3',
  trial: 'bg-info',
};
const mobileStatus: Record<SubStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'active', bg: 'bg-success-bg', text: 'text-success', dot: 'bg-success' },
  trialing: { label: 'trialing', bg: 'bg-info-bg', text: 'text-info', dot: 'bg-info' },
  past_due: { label: 'past due', bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning' },
  paused: { label: 'paused', bg: 'bg-surface-3', text: 'text-muted-foreground', dot: 'bg-subtle-foreground' },
  canceled: { label: 'canceled', bg: 'bg-surface-3', text: 'text-muted-foreground', dot: 'bg-subtle-foreground' },
  incomplete: { label: 'incomplete', bg: 'bg-surface-3', text: 'text-muted-foreground', dot: 'bg-subtle-foreground' },
  churned: { label: 'churned', bg: 'bg-danger-bg', text: 'text-danger', dot: 'bg-danger' },
};
const mobileRail: Record<Rail, { icon: LucideIcon; label: string; color: string }> = {
  card: { icon: CreditCard, label: 'Card', color: 'text-info' },
  ddebit: { icon: Landmark, label: 'Direct debit', color: 'text-accent' },
  transfer: { icon: ArrowLeftRight, label: 'Transfer', color: 'text-info' },
};


// Segment → row predicate. Filtering is a real read; tabs are links to ?segment=.
const SEGMENTS = ['all', 'recovery', 'churn', 'trialing', 'paused', 'canceled'] as const;
type Segment = (typeof SEGMENTS)[number];
function inSegment(r: SubRow, seg: Segment): boolean {
  switch (seg) {
    case 'recovery':
    case 'churn':
      return r.status === 'past_due';
    case 'trialing':
      return r.status === 'trialing';
    case 'paused':
      return r.status === 'paused';
    case 'canceled':
      return r.status === 'canceled';
    case 'all':
    default:
      return true;
  }
}

// Empty/error states are reachable in production when the fetched dataset (or a
// filtered segment) is empty, or a fetch throws (see loading.tsx / error.tsx).
// `?state=` is a design-preview switch for those same components.
type ListState = 'loading' | 'zero' | 'filtered' | 'error';

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ drawer?: string; state?: string; segment?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const drawerOpen = Boolean(sp.drawer);
  const drawerDetail = drawerOpen ? await getSubscriptionDetail(sp.drawer!) : null;
  const preview = sp.state as ListState | undefined;
  const sort: SubSortKey = SUB_SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SubSortKey) : 'at_risk';
  const segment: Segment = (SEGMENTS as readonly string[]).includes(sp.segment ?? '')
    ? (sp.segment as Segment)
    : 'all';

  const [view, session, newSubData] = await Promise.all([getSubscriptionsView(sort), getSession(), getNewSubscriptionData()]);
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;
  const { metrics } = view;
  const rows = view.rows.filter((r) => inSegment(r, segment));

  // Honest state: no subs at all → zero; a filtered segment emptied → filtered.
  // `?state=` overrides for design preview.
  const state: ListState | undefined =
    preview ?? (metrics.total === 0 ? 'zero' : rows.length === 0 ? 'filtered' : undefined);

  const bookHealth = [
    { grow: metrics.segments[0].count, c: 'bg-success' },
    { grow: metrics.segments[1].count, c: 'bg-warning' },
    { grow: metrics.segments[2].count, c: 'bg-danger' },
    { grow: metrics.segments[3].count, c: 'bg-subtle-foreground' },
  ];
  const legend = [
    { dot: 'bg-success', label: `Billing cleanly ${metrics.segments[0].count}` },
    { dot: 'bg-warning', label: `In recovery ${metrics.segments[1].count}` },
    { dot: 'bg-danger', label: `Past due ${metrics.segments[2].count}` },
    { dot: 'bg-subtle-foreground', label: `Churned ${metrics.segments[3].count}` },
  ];
  const mobileLegend = [
    { dot: 'bg-success', label: 'Clean', count: String(metrics.segments[0].count) },
    { dot: 'bg-warning', label: 'Recovery', count: String(metrics.segments[1].count) },
    { dot: 'bg-danger', label: 'Past due', count: String(metrics.segments[2].count) },
    { dot: 'bg-subtle-foreground', label: 'Churned', count: String(metrics.segments[3].count) },
  ];
  const tabs = metrics.tabs.map((t) => ({
    key: t.key,
    label: `${t.label} · ${t.count.toLocaleString()}`,
    active: t.key === segment || (segment === 'all' && t.key === 'all'),
  }));

  return (
    <>
    <div className="flex flex-col gap-3 px-4 py-4 lg:gap-5 lg:px-7 lg:py-6">
      {/* Page header — desktop only */}
      <div className="hidden items-center justify-between lg:flex">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Subscriptions</h1>
          <p className="text-[14px] text-muted-foreground">
            The book of recurring revenue. Every subscription, its health, and what needs you.
          </p>
        </div>
        <NewSubscriptionFlow
          canManage={canManage}
          data={newSubData}
          triggerClassName="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        />
      </div>

      {/* ── MOBILE layout (Z8CIJ) ── */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* Command strip */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-1 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">BOOK OF REVENUE</span>
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{metrics.mrrShort} MRR</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">AT RISK</span>
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-warning">{metrics.atRiskShort}</span>
            </div>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3">
            {bookHealth.map((s, i) => (
              <div key={i} className={s.c} style={{ flexGrow: s.grow }} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {mobileLegend.map((l) => (
              <div key={l.label} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className={`size-1.5 rounded-full ${l.dot}`} />
                  <span className="text-[12px] font-semibold text-foreground">{l.count}</span>
                </div>
                <span className="text-[10.5px] text-subtle-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter pills */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'all' ? '/subscriptions' : `/subscriptions?segment=${t.key}`}
              scroll={false}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                t.active ? 'border-accent-border bg-accent-muted text-accent' : 'border-border bg-surface-2 text-muted-foreground'
              }`}
            >
              {t.label.split(' · ')[0]}
            </Link>
          ))}
        </div>

        {/* Subscription cards */}
        {state ? (
          <div className="rounded-lg border border-border bg-surface-1 p-6 text-center text-[13px] text-muted-foreground">
            {state === 'zero'
              ? 'No subscriptions yet.'
              : state === 'filtered'
                ? 'Nothing in this segment.'
                : 'Could not load subscriptions.'}
          </div>
        ) : (
          rows.map((r) => {
            const st = mobileStatus[r.status];
            const rail = r.rail ? mobileRail[r.rail] : null;
            const RailIcon = rail?.icon;
            return (
              <div
                key={r.reference}
                className={`flex flex-col gap-2.5 rounded-lg border bg-surface-1 p-3.5 ${
                  r.status === 'past_due' ? 'border-warning-bg' : 'border-border'
                }`}
              >
                {/* Top */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">{r.name}</span>
                    <span className="truncate font-mono text-[11px] text-subtle-foreground">
                      {r.cus} · {r.plan} · {r.mrr}/mo
                    </span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-[9px] py-[3px] ${st.bg}`}>
                    <span className={`size-[5px] rounded-full ${st.dot}`} />
                    <span className={`text-[11px] font-medium ${st.text}`}>{st.label}</span>
                  </span>
                </div>
                {/* Health bar */}
                <div className="flex items-center gap-1">
                  {r.health.map((c, i) => (
                    <span key={i} className={`h-[5px] flex-1 rounded-full ${cycleColor[c]}`} />
                  ))}
                </div>
                {/* Bottom */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    {rail && RailIcon ? (
                      <span className="inline-flex items-center gap-[5px] rounded-sm border border-border bg-surface-2 px-2 py-[3px]">
                        <RailIcon className={`size-3 ${rail.color}`} strokeWidth={2} />
                        <span className="text-[11px] font-medium text-muted-foreground">{rail.label}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-sm border border-border bg-surface-2 px-2 py-[3px] text-[11px] font-medium text-subtle-foreground">
                        No method
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-foreground">{r.mrr}</span>
                  </div>
                  <span
                    className={`min-w-0 truncate text-right text-[11.5px] ${r.recovery ? 'text-warning' : 'text-muted-foreground'}`}
                  >
                    {r.recovery ? r.recovery.text : r.renews?.label}
                  </span>
                </div>
                {/* Actions (past-due only) */}
                {r.status === 'past_due' ? (
                  <div className="flex gap-2 border-t border-border pt-2.5">
                    <button
                      disabled
                      title="The billing engine emails the pay link automatically on a failed charge — there is no manual send."
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-[12px] font-medium text-accent-foreground disabled:opacity-50"
                    >
                      <Link2 className="size-[13px]" strokeWidth={2} />
                      Send pay link
                    </button>
                    <Link
                      href={`/subscriptions/${r.reference}`}
                      title="Open the recovery cockpit to update the card"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-surface-2 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3"
                    >
                      <CreditCard className="size-[13px]" strokeWidth={2} />
                      Update card
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:contents">
      {state === 'loading' ? (
        <SubscriptionsSkeleton />
      ) : (
        <>
      {/* Command bar */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-surface-1 px-5 py-4">
        {/* MRR */}
        <div className="flex shrink-0 flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">MRR</span>
          <span className="text-[27px] font-semibold leading-none tracking-[-0.5px] text-foreground">{metrics.mrrShort}</span>
          <span className="text-[12.5px] text-subtle-foreground">Normalized monthly</span>
        </div>
        <div className="h-14 w-px shrink-0 bg-border" />
        {/* Book health */}
        <div className="flex flex-1 flex-col gap-[9px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foreground">Book health</span>
            <span className="text-[12px] text-subtle-foreground">
              {metrics.total.toLocaleString()} subscription{metrics.total === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-3">
            {bookHealth.map((s, i) => (
              <div key={i} className={s.c} style={{ flexGrow: s.grow }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-[7px]">
                <span className={`size-[7px] rounded-full ${l.dot}`} />
                <span className="text-[12px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-14 w-px shrink-0 bg-border" />
        {/* At risk */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">REVENUE AT RISK</span>
          <span className="text-[24px] font-semibold leading-none tracking-[-0.5px] text-danger">{metrics.atRiskShort}</span>
          <Link href="/subscriptions?segment=recovery" scroll={false} className="flex items-center gap-1.5 text-[12px] text-accent hover:underline">
            View at-risk
            <ArrowRight className="size-3" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Segment bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'all' ? '/subscriptions' : `/subscriptions?segment=${t.key}`}
              scroll={false}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                t.active ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <SubSortControl current={sort} sorts={SUB_SORTS} segment={segment} />
      </div>

      {/* Table / empty / error */}
      {state === 'zero' ? (
        <EmptyState
          icon={RefreshCw}
          iconTone="accent"
          title="No subscriptions yet"
          titleSize={16}
          description={'Create your first subscription to start billing\ncustomers over card, direct debit, or transfer.'}
          action={
            <NewSubscriptionFlow
              canManage={canManage}
              data={newSubData}
              iconClassName="size-[15px]"
              triggerClassName="flex items-center gap-[7px] rounded bg-accent px-3.5 py-[9px] text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
            />
          }
        />
      ) : state === 'filtered' ? (
        <EmptyState
          icon={Search}
          title="No subscriptions match this segment"
          titleSize={15}
          description={'Nothing here right now.\nTry another segment or clear the filter.'}
          action={
            <Link
              href="/subscriptions"
              className="flex items-center gap-[7px] rounded border border-border-strong bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3"
            >
              <X className="size-3.5" strokeWidth={2} />
              Clear filter
            </Link>
          }
        />
      ) : state === 'error' ? (
        <ErrorState />
      ) : (
      <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
        {/* Header */}
        <div className="flex items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">SUBSCRIBER</span>
          <span className={COLS}>PLAN</span>
          <span className="w-[88px] text-right">MRR</span>
          <span className="w-[130px]">HEALTH · 6 CYCLES</span>
          <span className={COLS}>RAIL</span>
          <span className="w-[210px]">RECOVERY / RENEWS</span>
          <span className="w-[110px]">STATUS</span>
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.reference}
            className={`flex items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
              i < rows.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            {/* Subscriber */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-muted-foreground">
                {r.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-medium text-foreground">{r.name}</span>
                <span className="truncate font-mono text-[11px] text-subtle-foreground">
                  {r.cus} · {r.plan}
                </span>
              </div>
            </div>

            {/* Plan */}
            <div className={COLS}>
              <span className="text-[13px] text-muted-foreground">{r.plan}</span>
            </div>

            {/* MRR */}
            <div className="w-[88px] text-right">
              <span className="font-mono text-[13px] text-foreground">{r.mrr}</span>
            </div>

            {/* Health */}
            <div className="w-[130px]">
              <HealthStrip cycles={r.health} />
            </div>

            {/* Rail */}
            <div className={COLS}>
              {r.rail ? (
                <RailBadge rail={r.rail} />
              ) : (
                <span className="text-[12px] text-subtle-foreground">No method</span>
              )}
            </div>

            {/* Recovery / Renews */}
            <div className="flex w-[210px] flex-col gap-[5px]">
              {r.recovery ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw
                      className={`size-[14px] shrink-0 ${r.recovery.tone === 'info' ? 'text-info' : 'text-warning'}`}
                      strokeWidth={1.75}
                    />
                    <span className={`text-[12px] font-medium ${r.recovery.tone === 'info' ? 'text-info' : 'text-warning'}`}>
                      {r.recovery.text}
                    </span>
                  </div>
                  <span className="text-[11px] text-subtle-foreground">{r.recovery.sub}</span>
                  <div className="flex gap-1.5 pt-0.5">
                    <Link
                      href={`/subscriptions/${r.reference}`}
                      title="Open the recovery cockpit for this subscription"
                      className="rounded-sm border border-border-strong bg-surface-2 px-[9px] py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
                    >
                      {r.recovery.action}
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
                  <span className={`text-[12px] ${r.renews?.tone === 'info' ? 'text-info' : 'text-muted-foreground'}`}>
                    {r.renews?.label ?? '—'}
                  </span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex w-[110px] items-center justify-between">
              <StatusBadge status={r.status} />
              <Link
                href={`/subscriptions?drawer=${encodeURIComponent(r.reference)}`}
                scroll={false}
                aria-label={`Triage ${r.name}`}
                className="text-subtle-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className="size-[15px]" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        ))}
      </div>
      )}
        </>
      )}
      </div>
    </div>

      {drawerOpen ? (
        <>
          <Link
            href="/subscriptions"
            scroll={false}
            aria-label="Close drawer"
            className="fixed inset-0 z-40 bg-black/40"
          />
          <div className="fixed right-0 top-0 z-50 h-screen">
            <TriageDrawer detail={drawerDetail} />
          </div>
        </>
      ) : null}
    </>
  );
}
