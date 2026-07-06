import {
  LifeBuoy,
  CreditCard,
  Link2,
  Terminal,
  ChevronDown,
  Copy,
  CircleX,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import { StatusBadge } from '@/components/console/status-badge';

/* ── demo data, shaped like SubscriptionResponseData + dunning + events ── */

const cockpitInfo = [
  { label: 'Branch', value: 'reschedule · payday-timed', tone: 'default' as const },
  { label: 'Next attempt', value: 'Fri 26 Sep, 02:00', tone: 'default' as const },
  { label: 'Grace access', value: 'ends in 41h · Sat 27 Sep 02:00', tone: 'warning' as const },
];

const attemptLog = [
  { title: 'Attempt 2 · insufficient_funds', sub: 'Insufficient funds · card ·4242', time: '12 Sep' },
  { title: 'Attempt 1 · insufficient_funds', sub: 'Insufficient funds · card ·4242', time: '1 Sep' },
  { title: 'Dunning scheduled', sub: 'Branch: reschedule · grace 72h', time: '2 Sep', ok: true },
];

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'upcoming';
const timeline: { type: string; meta: string; time: string; tone: Tone }[] = [
  { type: 'subscription.created', meta: 'Gym Monthly · card ·4242', time: '1 Jun', tone: 'neutral' },
  { type: 'invoice.payment_succeeded', meta: '₦9,800 · card ·4242', time: '1 Jul', tone: 'success' },
  { type: 'invoice.payment_succeeded', meta: '₦9,800 · card ·4242', time: '1 Aug', tone: 'success' },
  { type: 'invoice.payment_failed', meta: 'insufficient_funds · attempt 1', time: '1 Sep', tone: 'danger' },
  { type: 'dunning.scheduled', meta: 'reschedule · payday-timed · grace 72h', time: '2 Sep', tone: 'warning' },
  { type: 'invoice.payment_failed', meta: 'insufficient_funds · attempt 2', time: '12 Sep', tone: 'danger' },
  { type: 'dunning.attempt_scheduled', meta: 'next attempt Fri 26 Sep 02:00', time: 'now', tone: 'warning' },
  { type: 'retry.upcoming', meta: 'payday-timed retry · ₦9,800', time: '26 Sep', tone: 'upcoming' },
];

const details: { label: string; value: string; tone?: 'warning' }[] = [
  { label: 'Status', value: 'Past due', tone: 'warning' },
  { label: 'Customer', value: 'ACME Gym' },
  { label: 'Price', value: 'Gym Monthly · ₦9,800/mo' },
  { label: 'Rail', value: 'Card ·4242' },
  { label: 'Collection', value: 'Automatic' },
  { label: 'Current period', value: '1 Sep → 1 Oct' },
  { label: 'Started', value: '1 Jun 2026' },
];

const upcomingLines: { label: string; value: string; strong?: boolean }[] = [
  { label: 'Subtotal', value: '₦9,800' },
  { label: 'Proration', value: '₦0' },
  { label: 'Amount due', value: '₦9,800', strong: true },
];

/* ── mobile (XKxmy) helpers ── */
const mobileSummary = [
  { k: 'MRR', v: '₦9,800' },
  { k: 'Period', v: '1–30 Sep' },
  { k: 'Next bill', v: '1 Oct' },
];
const mobileCockpit = [
  { k: 'Branch', v: 'reschedule' },
  { k: 'Grace ends', v: 'in 41h' },
  { k: 'Next retry', v: '26 Sep' },
];

const dotC: Record<Tone, string> = {
  neutral: 'bg-subtle-foreground',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  upcoming: 'bg-border-strong',
};
const typeC: Record<Tone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  upcoming: 'text-muted-foreground',
};

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

export default function SubscriptionDetailPage() {
  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Header — desktop only */}
      <div className="hidden items-start justify-between lg:flex">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">ACME Gym</h1>
            <StatusBadge status="past_due" />
          </div>
          <p className="text-[13.5px] text-muted-foreground">
            Gym Monthly · ₦9,800 / month · Automatic · in recovery, next attempt 26 Sep
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
            <Terminal className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
            Reproduce
          </button>
          <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
            Actions
            <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Mobile back + status row */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/subscriptions" aria-label="Back to subscriptions" className="shrink-0 text-foreground">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold text-foreground">ACME Gym</span>
            <span className="truncate font-mono text-[10.5px] text-subtle-foreground">nbo749201835566sub</span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-bg px-[9px] py-[3px]">
          <span className="size-[5px] rounded-full bg-warning" />
          <span className="text-[11px] font-medium text-warning">past due</span>
        </span>
      </div>

      {/* ── MOBILE layout (XKxmy) ── */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* Summary */}
        <CardShell className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold text-foreground">Gym Monthly</span>
              <span className="truncate font-mono text-[11px] text-subtle-foreground">nbo_cus_8fk2 · ACME Gym</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-[5px] rounded-sm border border-border bg-surface-2 px-2 py-[3px]">
              <CreditCard className="size-3 text-info" strokeWidth={2} />
              <span className="text-[11px] font-medium text-muted-foreground">Card ·4242</span>
            </span>
          </div>
          <div className="flex border-t border-border pt-3">
            {mobileSummary.map((f) => (
              <div key={f.k} className="flex flex-1 flex-col gap-[3px]">
                <span className="font-mono text-[10px] tracking-[0.3px] text-subtle-foreground">{f.k}</span>
                <span className="text-[14px] font-semibold text-foreground">{f.v}</span>
              </div>
            ))}
          </div>
        </CardShell>

        {/* Recovery cockpit */}
        <div className="flex flex-col gap-3 rounded-lg border border-warning bg-warning-bg p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-warning" strokeWidth={1.75} />
              <span className="text-[14.5px] font-semibold text-foreground">In recovery</span>
            </div>
            <span className="font-mono text-[11.5px] text-warning">attempt 3 of 4</span>
          </div>
          <div className="flex gap-2.5">
            {mobileCockpit.map((t) => (
              <div key={t.k} className="flex flex-1 flex-col gap-[3px]">
                <span className="font-mono text-[10px] tracking-[0.3px] text-subtle-foreground">{t.k}</span>
                <span className="text-[12.5px] font-semibold text-foreground">{t.v}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              <Link2 className="size-[13px]" strokeWidth={2} />
              Send pay link
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-surface-2 px-3 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
              <CreditCard className="size-[13px]" strokeWidth={2} />
              Update card
            </button>
          </div>
        </div>

        {/* Timeline */}
        <CardShell className="flex flex-col p-3.5">
          <span className="pb-1 text-[13.5px] font-semibold text-foreground">Bill · fail · recover</span>
          <div className="flex flex-col pt-2.5">
            {timeline.map((n, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex w-4 flex-col items-center">
                  <span className={`mt-0.5 size-[11px] shrink-0 rounded-full ring-2 ring-surface-1 ${dotC[n.tone]}`} />
                  {i < timeline.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className={`truncate font-mono text-[12px] ${typeC[n.tone]}`}>{n.type}</span>
                    <span className="shrink-0 text-[11px] text-subtle-foreground">{n.time}</span>
                  </div>
                  <span className="truncate text-[11.5px] text-muted-foreground">{n.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </CardShell>

        {/* Upcoming invoice */}
        <CardShell className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-semibold text-foreground">Upcoming invoice</span>
            <span className="text-[11.5px] text-muted-foreground">1 Oct</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">Gym Monthly · 1 mo</span>
            <span className="font-mono text-[12.5px] text-foreground">₦9,800</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">Proration</span>
            <span className="font-mono text-[12.5px] text-foreground">₦0</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-[12.5px] font-semibold text-foreground">Amount due</span>
            <span className="font-mono text-[12.5px] font-semibold text-foreground">₦9,800</span>
          </div>
        </CardShell>

        {/* Reproduce this */}
        <CardShell className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-semibold text-foreground">Reproduce this</span>
            <span className="inline-flex items-center gap-[5px] rounded-sm border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground">
              <Copy className="size-3" strokeWidth={1.75} />
              Copy
            </span>
          </div>
          <div className="flex flex-col gap-[3px] overflow-hidden rounded border border-border bg-background p-3">
            <span className="whitespace-pre font-mono text-[11px] text-accent">
              POST /v1/subscriptions/nbo749…sub
            </span>
            <span className="whitespace-pre font-mono text-[11px] text-muted-foreground">
              {'  /pay --idempotency-key $(uuid)'}
            </span>
            <span className="whitespace-pre font-mono text-[11px] text-muted-foreground">
              Authorization: Bearer nbo_sandbox_…
            </span>
          </div>
        </CardShell>
      </div>

      {/* Columns — desktop only */}
      <div className="hidden min-h-0 flex-1 gap-[18px] lg:flex">
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Recovery cockpit */}
          <CardShell className="flex flex-col gap-[14px] border-warning p-[18px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LifeBuoy className="size-[17px] text-warning" strokeWidth={1.75} />
                <span className="text-[15px] font-semibold text-foreground">Recovery</span>
              </div>
              <span className="rounded-full bg-warning-bg px-[9px] py-[3px] text-[12px] font-medium text-warning">
                Attempt 3 of 4
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {cockpitInfo.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-[110px] shrink-0 text-[12.5px] text-subtle-foreground">{r.label}</span>
                  <span className={`text-[13px] font-medium ${r.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <button className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                <CreditCard className="size-4" strokeWidth={2} />
                Update card
              </button>
              <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
                <Link2 className="size-4" strokeWidth={1.75} />
                Send link
              </button>
              <span className="text-[11.5px] text-subtle-foreground">No blind retry, the bank requires the customer.</span>
            </div>

            <div className="h-px w-full bg-border" />
            <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">ATTEMPT LOG</span>
            <div className="flex flex-col">
              {attemptLog.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-[11px] py-[9px] ${i < attemptLog.length - 1 ? 'border-b border-border' : ''}`}
                >
                  {a.ok ? (
                    <Clock className="size-4 shrink-0 text-warning" strokeWidth={1.75} />
                  ) : (
                    <CircleX className="size-4 shrink-0 text-danger" strokeWidth={1.75} />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[12.5px] font-medium text-foreground">{a.title}</span>
                    <span className="text-[11px] text-subtle-foreground">{a.sub}</span>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-subtle-foreground">{a.time}</span>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Timeline */}
          <CardShell className="flex min-h-0 flex-1 flex-col overflow-hidden p-[18px]">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[15px] font-semibold text-foreground">Bill · fail · recover</span>
              <span className="font-mono text-[11px] text-subtle-foreground">lifecycle</span>
            </div>
            <div className="flex flex-col">
              {timeline.map((n, i) => (
                <div key={i} className="flex gap-3 py-2">
                  <div className="flex w-4 flex-col items-center">
                    <span className={`mt-1 size-[9px] shrink-0 rounded-full ${dotC[n.tone]}`} />
                    {i < timeline.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate font-mono text-[12.5px] ${typeC[n.tone]}`}>{n.type}</span>
                      <span className="shrink-0 text-[11.5px] text-subtle-foreground">{n.time}</span>
                    </div>
                    <span className="truncate text-[11.5px] text-muted-foreground">{n.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        {/* Right */}
        <div className="flex w-[344px] shrink-0 flex-col gap-4">
          {/* Details */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Details</span>
            <div className="flex flex-col">
              {details.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between py-2 ${i < details.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
                  <span className={`text-[12.5px] font-medium ${f.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Upcoming invoice */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Upcoming invoice</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">draft</span>
            </div>
            <span className="font-mono text-[12px] text-muted-foreground">#3 · 1 Oct → 1 Nov · cycle</span>
            <div className="flex flex-col gap-2">
              {upcomingLines.map((l) => (
                <div key={l.label} className="flex items-center justify-between">
                  <span className={`text-[12.5px] ${l.strong ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {l.label}
                  </span>
                  <span className={`font-mono text-[13px] ${l.strong ? 'font-medium text-foreground' : 'text-foreground'}`}>
                    {l.value}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-subtle-foreground">
              Not yet issued. Computed live from the schedule and price.
            </span>
          </CardShell>

          {/* Scheduled changes */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Scheduled changes</span>
            <div className="flex flex-col gap-2 pb-1 pt-1.5">
              <span className="text-[12.5px] text-muted-foreground">No scheduled changes.</span>
              <span className="text-[11px] text-subtle-foreground">
                Plan swaps and cancellations at period end appear here.
              </span>
            </div>
          </CardShell>

          {/* Reproduce this */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Reproduce this</span>
              <div className="flex items-center gap-1">
                {['cURL', 'Node', 'Python'].map((t) => (
                  <span
                    key={t}
                    className={`rounded-sm px-2 py-0.5 text-[11px] ${t === 'Node' ? 'bg-surface-2 text-foreground' : 'text-subtle-foreground'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 rounded border border-border bg-background p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[12px] text-foreground">await nomba.subscriptions</span>
                <span className="font-mono text-[12px] text-accent">{'  .retrieve("nbo749201835566sub")'}</span>
              </div>
              <Copy className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
