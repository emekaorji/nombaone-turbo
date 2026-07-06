import Link from 'next/link';

import {
  Plus,
  ChevronRight,
  ChevronDown,
  Columns3,
  ArrowRight,
  ShieldAlert,
  Timer,
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

import { StatusBadge, type SubStatus } from '@/components/console/status-badge';
import { HealthStrip, type Cycle } from '@/components/console/health-strip';
import { RailBadge, type Rail } from '@/components/console/rail-badge';
import { TriageDrawer } from '@/components/console/triage-drawer';
import { EmptyState } from '@/components/console/empty-state';
import { ErrorState } from '@/components/console/states/error-state';
import { SubscriptionsSkeleton } from '@/components/console/states/subscriptions-skeleton';

type Recovery = { icon: LucideIcon; tone: 'info' | 'warning'; text: string; sub: string; action: string };
type Row = {
  name: string;
  cus: string;
  plan: string;
  mrr: string;
  health: Cycle[];
  rail: Rail;
  status: SubStatus;
  recovery?: Recovery;
  renews?: { label: string; tone?: 'info' };
};

const rows: Row[] = [
  {
    name: 'Uche Media', cus: 'nbo8fk…cus', plan: 'Annual Pro', mrr: '₦10,000',
    health: ['paid', 'paid', 'paid', 'failed', 'failed', 'upcoming'], rail: 'card', status: 'past_due',
    recovery: { icon: ShieldAlert, tone: 'info', text: 'OTP required · ₦120,000 due', sub: 'Checkout link sent · grace 22h', action: 'Copy link' },
  },
  {
    name: 'Bola Foods', cus: 'nbo2mp…cus', plan: 'Growth', mrr: '₦40,000',
    health: ['paid', 'paid', 'paid', 'paid', 'failed', 'upcoming'], rail: 'ddebit', status: 'past_due',
    recovery: { icon: Timer, tone: 'warning', text: 'Retry payday 26 Sep · ₦40,000', sub: 'Awaiting mandate debit', action: 'Update mandate' },
  },
  {
    name: 'Zed Studio', cus: 'nbop04…cus', plan: 'Starter', mrr: '₦1,500',
    health: ['paid', 'recovered', 'paid', 'paid', 'paid', 'upcoming'], rail: 'card', status: 'active',
    renews: { label: 'Renews in 8 days' },
  },
  {
    name: 'Kola Retail', cus: 'nbor7t…cus', plan: 'Scale', mrr: '₦120,000',
    health: ['paid', 'paid', 'paid', 'paid', 'paid', 'upcoming'], rail: 'ddebit', status: 'active',
    renews: { label: 'Renews in 3 days' },
  },
  {
    name: 'Ada Obi', cus: 'nbo9c2…cus', plan: 'Growth', mrr: '₦40,000',
    health: ['paid', 'paid', 'failed', 'recovered', 'paid', 'upcoming'], rail: 'card', status: 'active',
    renews: { label: 'Renews in 21 days' },
  },
  {
    name: 'Mira Ltd', cus: 'nbo55b…cus', plan: 'Pro', mrr: '₦75,000',
    health: ['paid', 'paid', 'paid', 'failed', 'failed', 'failed'], rail: 'transfer', status: 'past_due',
    recovery: { icon: ArrowLeftRight, tone: 'warning', text: 'Awaiting transfer · ₦75,000', sub: 'Reminder sent 2h ago', action: 'Send link' },
  },
  {
    name: 'Pau Ade', cus: 'nbo18d…cus', plan: 'Starter', mrr: '₦1,500',
    health: ['trial', 'trial', 'upcoming', 'upcoming', 'upcoming', 'upcoming'], rail: 'card', status: 'trialing',
    renews: { label: 'Trial ends in 3 days', tone: 'info' },
  },
  {
    name: 'Tobi Co', cus: 'nbo7ff…cus', plan: 'Growth', mrr: '₦40,000',
    health: ['paid', 'paid', 'paid', 'paid', 'paid', 'upcoming'], rail: 'card', status: 'active',
    renews: { label: 'Renews in 12 days' },
  },
  {
    name: 'Nia Books', cus: 'nboa30…cus', plan: 'Starter', mrr: '₦1,500',
    health: ['paid', 'paid', 'paid', 'paid', 'failed', 'upcoming'], rail: 'ddebit', status: 'past_due',
    recovery: { icon: CreditCard, tone: 'info', text: 'Card expired · ₦1,500', sub: 'Update requested', action: 'Update card' },
  },
];

const tabs = [
  { label: 'All · 1,237', active: true },
  { label: 'In recovery · 37', active: false },
  { label: 'Churn risk · 12', active: false },
  { label: 'Trialing · 52', active: false },
  { label: 'Paused · 9', active: false },
  { label: 'Canceled', active: false },
];

const bookHealth = [
  { grow: 452, c: 'bg-success' },
  { grow: 22, c: 'bg-warning' },
  { grow: 34, c: 'bg-danger' },
  { grow: 24, c: 'bg-subtle-foreground' },
];
const legend = [
  { dot: 'bg-success', label: 'Billing cleanly 1,180' },
  { dot: 'bg-warning', label: 'In recovery 37' },
  { dot: 'bg-danger', label: 'Past due 11' },
  { dot: 'bg-subtle-foreground', label: 'Churned 9' },
];

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
const mobileLegend = [
  { dot: 'bg-success', label: 'Clean', count: '1,180' },
  { dot: 'bg-warning', label: 'Recovery', count: '37' },
  { dot: 'bg-danger', label: 'Past due', count: '11' },
  { dot: 'bg-subtle-foreground', label: 'Churned', count: '9' },
];

// Empty/error states are reachable in production when the fetched dataset (or a
// filtered segment) is empty, or a fetch throws (see loading.tsx / error.tsx).
// `?state=` is a design-preview switch for those same components.
type ListState = 'loading' | 'zero' | 'filtered' | 'error';

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ drawer?: string; state?: string }>;
}) {
  const sp = await searchParams;
  const drawerOpen = Boolean(sp.drawer);
  const state = sp.state as ListState | undefined;
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
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          New subscription
        </button>
      </div>

      {/* ── MOBILE layout (Z8CIJ) ── */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* Command strip */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-1 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">BOOK OF REVENUE</span>
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">₦4.82M MRR</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">AT RISK</span>
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-warning">₦1.14M</span>
            </div>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
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
          {tabs.map((t, i) => (
            <span
              key={t.label}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                i === 0 ? 'border-accent-border bg-accent-muted text-accent' : 'border-border bg-surface-2 text-muted-foreground'
              }`}
            >
              {t.label.split(' · ')[0]}
            </span>
          ))}
        </div>

        {/* Subscription cards */}
        {rows.map((r) => {
          const st = mobileStatus[r.status];
          const rail = mobileRail[r.rail];
          const RailIcon = rail.icon;
          return (
            <div
              key={r.name}
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
                  <span className="inline-flex items-center gap-[5px] rounded-sm border border-border bg-surface-2 px-2 py-[3px]">
                    <RailIcon className={`size-3 ${rail.color}`} strokeWidth={2} />
                    <span className="text-[11px] font-medium text-muted-foreground">{rail.label}</span>
                  </span>
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
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                    <Link2 className="size-[13px]" strokeWidth={2} />
                    Send pay link
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-surface-2 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3">
                    <CreditCard className="size-[13px]" strokeWidth={2} />
                    Update card
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
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
          <span className="text-[27px] font-semibold leading-none tracking-[-0.5px] text-foreground">₦4.82M</span>
          <span className="text-[12.5px] text-success">▲ 12.4% · 30 days</span>
        </div>
        <div className="h-14 w-px shrink-0 bg-border" />
        {/* Book health */}
        <div className="flex flex-1 flex-col gap-[9px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foreground">Book health</span>
            <span className="text-[12px] text-subtle-foreground">1,237 subscriptions</span>
          </div>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
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
          <span className="text-[24px] font-semibold leading-none tracking-[-0.5px] text-danger">₦1.14M</span>
          <button className="flex items-center gap-1.5 text-[12px] text-accent hover:underline">
            View at-risk
            <ArrowRight className="size-3" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Segment bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.label}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                t.active ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-subtle-foreground">Sorted by revenue at risk</span>
          <ChevronDown className="size-[14px] text-subtle-foreground" strokeWidth={1.75} />
          <button className="flex size-[30px] items-center justify-center rounded border border-border text-subtle-foreground transition-colors hover:text-foreground">
            <Columns3 className="size-[15px]" strokeWidth={1.75} />
          </button>
        </div>
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
            <button className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-[9px] text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover">
              <Plus className="size-[15px]" strokeWidth={2} />
              New subscription
            </button>
          }
        />
      ) : state === 'filtered' ? (
        <EmptyState
          icon={Search}
          title="No subscriptions match this segment"
          titleSize={15}
          description={'Nothing in “Churn risk” right now.\nThat is good news for the book.'}
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
            key={r.name}
            className={`flex items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
              i < rows.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            {/* Subscriber */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-muted-foreground">
                {r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
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
              <RailBadge rail={r.rail} />
            </div>

            {/* Recovery / Renews */}
            <div className="flex w-[210px] flex-col gap-[5px]">
              {r.recovery ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <r.recovery.icon
                      className={`size-[14px] shrink-0 ${r.recovery.tone === 'info' ? 'text-info' : 'text-warning'}`}
                      strokeWidth={1.75}
                    />
                    <span className={`text-[12px] font-medium ${r.recovery.tone === 'info' ? 'text-info' : 'text-warning'}`}>
                      {r.recovery.text}
                    </span>
                  </div>
                  <span className="text-[11px] text-subtle-foreground">{r.recovery.sub}</span>
                  <div className="flex gap-1.5 pt-0.5">
                    <button className="rounded-sm border border-border-strong bg-surface-2 px-[9px] py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                      {r.recovery.action}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
                  <span className={`text-[12px] ${r.renews?.tone === 'info' ? 'text-info' : 'text-muted-foreground'}`}>
                    {r.renews?.label}
                  </span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex w-[110px] items-center justify-between">
              <StatusBadge status={r.status} />
              <Link
                href={`/subscriptions?drawer=${encodeURIComponent(r.cus)}`}
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
            <TriageDrawer />
          </div>
        </>
      ) : null}
    </>
  );
}
