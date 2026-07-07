export const dynamic = 'force-dynamic';

import { LifeBuoy, Link2, CircleX, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { StatusBadge } from '@/components/console/status-badge';
import { SubscriptionActions } from '@/components/console/subscription-actions';
import { RecoveryUpdateCardButton } from '@/components/console/recovery-update-card-button';
import { getSession } from '@/lib/auth';
import { getSubscriptionDetail, type TimelineTone } from '@/lib/subscription-detail';
import { getActivePrices } from '@/lib/subscription-form';

const dotC: Record<TimelineTone, string> = {
  neutral: 'bg-subtle-foreground',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  upcoming: 'bg-border-strong',
};
const typeC: Record<TimelineTone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  upcoming: 'text-muted-foreground',
};

// A pay link is customer-facing dunning: the engine emails it automatically on failure — there is no
// manual merchant "send now" trigger (by design, to avoid duplicate/confusing customer prompts).
const SEND_LINK_BLOCKED = 'The billing engine emails the pay link automatically on a failed charge — there is no manual send.';

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, session, prices] = await Promise.all([getSubscriptionDetail(decodeURIComponent(id)), getSession(), getActivePrices()]);
  if (!s) notFound();
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Header — desktop only */}
      <div className="hidden items-start justify-between lg:flex">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">{s.customerName}</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-[13.5px] text-muted-foreground">{s.headline}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <SubscriptionActions subscriptionReference={s.reference} status={s.status} canManage={canManage} prices={prices} methods={s.methods} />
        </div>
      </div>

      {/* Mobile back + status row */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/subscriptions" aria-label="Back to subscriptions" className="shrink-0 text-foreground">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold text-foreground">{s.customerName}</span>
            <span className="truncate font-mono text-[10.5px] text-subtle-foreground">{s.reference}</span>
          </div>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Columns — desktop */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-[18px]">
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Recovery cockpit — only when actually in recovery */}
          {s.recovery.active ? (
            <CardShell className="flex flex-col gap-[14px] border-warning p-[18px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="size-[17px] text-warning" strokeWidth={1.75} />
                  <span className="text-[15px] font-semibold text-foreground">Recovery</span>
                </div>
                <span className="rounded-full bg-warning-bg px-[9px] py-[3px] text-[12px] font-medium text-warning">
                  {s.recovery.attemptLabel}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {s.recovery.info.map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-[110px] shrink-0 text-[12.5px] text-subtle-foreground">{r.label}</span>
                    <span className={`text-[13px] font-medium ${r.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <RecoveryUpdateCardButton subscriptionReference={s.reference} methods={s.methods} canManage={canManage} />
                <button
                  disabled
                  title={SEND_LINK_BLOCKED}
                  className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-foreground disabled:opacity-50"
                >
                  <Link2 className="size-4" strokeWidth={1.75} />
                  Send link
                </button>
                <span className="text-[11.5px] text-subtle-foreground">No blind retry, the bank requires the customer.</span>
              </div>

              {s.recovery.log.length > 0 ? (
                <>
                  <div className="h-px w-full bg-border" />
                  <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">ATTEMPT LOG</span>
                  <div className="flex flex-col">
                    {s.recovery.log.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-[11px] py-[9px] ${i < s.recovery.log.length - 1 ? 'border-b border-border' : ''}`}
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
                </>
              ) : null}
            </CardShell>
          ) : null}

          {/* Timeline */}
          <CardShell className="flex min-h-0 flex-1 flex-col overflow-hidden p-[18px]">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[15px] font-semibold text-foreground">Bill · fail · recover</span>
              <span className="font-mono text-[11px] text-subtle-foreground">lifecycle</span>
            </div>
            {s.timeline.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8 text-center text-[12.5px] text-muted-foreground">
                No lifecycle events yet. Bills, failures, and recoveries appear here as they happen.
              </div>
            ) : (
              <div className="flex flex-col">
                {s.timeline.map((n, i) => (
                  <div key={i} className="flex gap-3 py-2">
                    <div className="flex w-4 flex-col items-center">
                      <span className={`mt-1 size-[9px] shrink-0 rounded-full ${dotC[n.tone]}`} />
                      {i < s.timeline.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
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
            )}
          </CardShell>
        </div>

        {/* Right */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[344px]">
          {/* Details */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Details</span>
            <div className="flex flex-col">
              {s.details.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between py-2 ${i < s.details.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
                  <span className={`text-[12.5px] font-medium capitalize ${f.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>
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
            <span className="font-mono text-[12px] text-muted-foreground">{s.upcoming.periodLabel}</span>
            <div className="flex flex-col gap-2">
              {s.upcoming.lines.map((l) => (
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
            <span className="text-[11px] text-subtle-foreground">Not yet issued. Computed live from the schedule and price.</span>
          </CardShell>

          {/* Scheduled changes */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Scheduled changes</span>
            {s.scheduledChanges.length === 0 ? (
              <div className="flex flex-col gap-2 pb-1 pt-1.5">
                <span className="text-[12.5px] text-muted-foreground">No scheduled changes.</span>
                <span className="text-[11px] text-subtle-foreground">Plan swaps and cancellations at period end appear here.</span>
              </div>
            ) : (
              <div className="flex flex-col">
                {s.scheduledChanges.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 py-2 ${i < s.scheduledChanges.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="min-w-0 truncate text-[12.5px] text-foreground">{c.label}</span>
                    <span className="shrink-0 text-[11px] text-subtle-foreground">{c.effective}</span>
                  </div>
                ))}
              </div>
            )}
          </CardShell>
        </div>
      </div>
    </div>
  );
}
