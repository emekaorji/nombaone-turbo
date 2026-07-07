export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { NewSubscriptionFlow } from '@/components/console/new-subscription-flow';
import { getSession } from '@/lib/auth';
import { getDunningView } from '@/lib/dunning';
import { getRecentEvents, type EventTone } from '@/lib/events';
import { getNewSubscriptionData } from '@/lib/subscription-form';
import { getSubscriptionsView } from '@/lib/subscriptions';

const evDot: Record<EventTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-subtle-foreground',
};
const evText: Record<EventTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-foreground',
};

export default async function OverviewPage() {
  const [session, subs, dunning, events, newSubData] = await Promise.all([
    getSession(),
    getSubscriptionsView(),
    getDunningView(),
    getRecentEvents(7),
    getNewSubscriptionData(),
  ]);
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;

  const m = subs.metrics;
  const segments = [
    { label: 'Active', value: m.activeCount.toLocaleString() },
    { label: 'Trialing', value: m.trialingCount.toLocaleString() },
    { label: 'In recovery', value: dunning.kpis.inRecovery.toLocaleString(), warn: dunning.kpis.inRecovery > 0 },
    { label: 'At risk', value: m.atRiskShort, warn: m.atRiskKobo > 0 },
  ];

  // Real book composition (not a fabricated new/expansion/churn waterfall — that
  // needs billing history; it is a named metrics build item).
  const composition = [
    { label: 'Billing cleanly', count: m.segments[0].count, c: 'bg-success', dot: 'bg-success' },
    { label: 'In recovery', count: m.segments[1].count, c: 'bg-warning', dot: 'bg-warning' },
    { label: 'Past due', count: m.segments[2].count, c: 'bg-danger', dot: 'bg-danger' },
    { label: 'Churned', count: m.segments[3].count, c: 'bg-subtle-foreground', dot: 'bg-subtle-foreground' },
  ];

  const funnel = ['scheduled', 'attempting', 'card_update', 'recovered'].map((k) => {
    const f = dunning.funnel.find((x) => x.key === k)!;
    return { value: f.value.toLocaleString(), label: f.label, good: k === 'recovered' };
  });

  const atRisk = dunning.worklist.slice(0, 3).map((r) => ({
    reference: r.reference,
    subscriptionReference: r.subscriptionReference,
    name: r.name,
    meta: `${r.plan} · ${r.atRisk}`,
    status: `${r.next} · ${r.grace}`,
    action: r.action,
  }));

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Page header — desktop only (mobile shows the section in the topbar) */}
      <div className="hidden items-center justify-between lg:flex">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Overview</h1>
          <p className="text-[14px] text-muted-foreground">
            {session?.org.name ?? 'Your organization'}, {session?.mode ?? 'sandbox'} mode. Your recurring revenue at a glance, and what needs you.
          </p>
        </div>
        <NewSubscriptionFlow
          canManage={canManage}
          data={newSubData}
          triggerClassName="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        />
      </div>

      {/* ── MOBILE layout ── */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        {/* MRR card */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4">
          <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">MRR</span>
          <span className="text-[34px] font-semibold leading-none tracking-[-1px] text-foreground">{m.mrrShort}</span>
          <span className="text-[12px] text-muted-foreground">
            {m.activeCount} active · {m.trialingCount} trialing · normalized monthly
          </span>
        </div>

        {/* 2×2 stat grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {segments.map((s) => (
            <div key={s.label} className="flex flex-col gap-[3px] rounded-lg border border-border bg-surface-1 px-3.5 py-3">
              <span className={`text-[20px] font-semibold tracking-[-0.3px] ${s.warn ? 'text-warning' : 'text-foreground'}`}>
                {s.value}
              </span>
              <span className="text-[12px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Needs attention */}
        <div className="flex flex-col rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[14.5px] font-semibold text-foreground">Needs attention</span>
            <span className="flex items-center gap-1.5 rounded-full bg-warning-bg px-[9px] py-[3px]">
              <span className="size-1.5 rounded-full bg-warning" />
              <span className="text-[11.5px] font-medium text-warning">{m.atRiskShort} at risk</span>
            </span>
          </div>
          {atRisk.length === 0 ? (
            <span className="py-3 text-[12.5px] text-muted-foreground">Everything is billing cleanly.</span>
          ) : (
            atRisk.slice(0, 2).map((r, i) => (
              <div
                key={r.reference}
                className={`flex items-center justify-between gap-2.5 py-[11px] ${i < 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-foreground">{r.name}</span>
                  <span className="truncate text-[11.5px] text-warning">{r.status}</span>
                </div>
                <Link
                  href={`/subscriptions/${r.subscriptionReference}`}
                  title="Open the recovery cockpit for this subscription"
                  className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-[11px] py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
                >
                  {r.action}
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Live */}
        <div className="flex flex-col rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-[14.5px] font-semibold text-foreground">Recent activity</span>
          </div>
          {events.length === 0 ? (
            <span className="py-3 text-[12.5px] text-muted-foreground">No events yet.</span>
          ) : (
            events.map((e) => (
              <div
                key={e.reference}
                className="flex items-center gap-2.5 border-b border-border py-[9px] last:border-b-0"
              >
                <span className={`size-[7px] shrink-0 rounded-full ${evDot[e.tone]}`} />
                <span className={`min-w-0 flex-1 truncate font-mono text-[12px] ${evText[e.tone]}`}>{e.type}</span>
                <span className="shrink-0 text-[11.5px] text-subtle-foreground">{e.time}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:contents">
      {/* Revenue command bar */}
      <div className="flex items-center gap-[26px] rounded-lg border border-border bg-surface-1 px-6 py-5">
        {/* MRR */}
        <div className="flex w-[210px] shrink-0 flex-col gap-[5px]">
          <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">MRR</span>
          <span className="text-[36px] font-semibold leading-none tracking-[-1px] text-foreground">{m.mrrShort}</span>
          <span className="text-[13px] text-subtle-foreground">Normalized monthly</span>
        </div>
        <div className="h-[92px] w-px shrink-0 bg-border" />
        {/* Book composition */}
        <div className="flex flex-1 flex-col gap-3">
          <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            BOOK COMPOSITION · {m.total.toLocaleString()} SUBSCRIPTION{m.total === 1 ? '' : 'S'}
          </span>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-3">
            {composition.map((c) => (
              <div key={c.label} className={c.c} style={{ flexGrow: c.count }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {composition.map((c) => (
              <div key={c.label} className="flex items-center gap-[7px]">
                <span className={`size-[7px] rounded-full ${c.dot}`} />
                <span className="text-[12px] text-muted-foreground">
                  {c.label} {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[92px] w-px shrink-0 bg-border" />
        {/* Segments */}
        <div className="flex w-[210px] shrink-0 flex-col gap-[9px]">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
              <span className={`font-mono text-[13px] font-medium ${s.warn ? 'text-warning' : 'text-foreground'}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: recovery cockpit + live event tail */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Recovery card */}
        <div className="flex flex-1 flex-col gap-[14px] overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold text-foreground">Needs attention</span>
              <span className="flex items-center gap-1.5 rounded-full bg-warning-bg px-[9px] py-[3px]">
                <span className="size-1.5 rounded-full bg-warning" />
                <span className="text-[11.5px] font-medium text-warning">{m.atRiskShort} at risk</span>
              </span>
            </div>
            <Link href="/dunning" className="text-[13px] text-accent hover:underline">Open recovery</Link>
          </div>

          {/* Dunning funnel */}
          <div className="flex items-center border-b border-border pb-3 pt-2.5">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex flex-1 items-center">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className={`text-[17px] font-semibold ${f.good ? 'text-success' : 'text-foreground'}`}>
                    {f.value}
                  </span>
                  <span className="font-mono text-[10px] text-subtle-foreground">{f.label}</span>
                </div>
                {i < funnel.length - 1 ? <div className="h-[30px] w-px bg-border" /> : null}
              </div>
            ))}
          </div>

          {/* At-risk rows */}
          {atRisk.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center text-[12.5px] text-muted-foreground">
              Everything is billing cleanly — nothing needs you right now.
            </div>
          ) : (
            atRisk.map((r, i) => (
              <div
                key={r.reference}
                className={`flex items-center justify-between gap-3 px-0.5 py-[11px] ${i < atRisk.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex flex-col gap-[3px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{r.name}</span>
                    <span className="text-[12px] text-muted-foreground">{r.meta}</span>
                  </div>
                  <span className="text-[11.5px] text-warning">{r.status}</span>
                </div>
                <Link
                  href={`/subscriptions/${r.subscriptionReference}`}
                  title="Open the recovery cockpit for this subscription"
                  className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-2.5 py-[5px] text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3"
                >
                  {r.action}
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Live card */}
        <div className="flex w-[404px] shrink-0 flex-col gap-0.5 overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[15px] font-semibold text-foreground">Recent activity</span>
            <Link href="/developers" className="text-[12px] text-accent hover:underline">
              All events
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8 text-center text-[12.5px] text-muted-foreground">
              No events yet. Activity appears here as your account bills and pays.
            </div>
          ) : (
            events.map((e) => (
              <div
                key={e.reference}
                className="flex items-center gap-[11px] border-b border-border py-[9px] last:border-b-0"
              >
                <span className={`size-2 shrink-0 rounded-full ${evDot[e.tone]}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate font-mono text-[12px] ${evText[e.tone]}`}>{e.type}</span>
                  <span className="truncate font-mono text-[10.5px] text-subtle-foreground">{e.detail}</span>
                </div>
                <span className="shrink-0 text-[11.5px] text-subtle-foreground">{e.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
