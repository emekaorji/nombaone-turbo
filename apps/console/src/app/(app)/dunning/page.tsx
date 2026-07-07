export const dynamic = 'force-dynamic';

import { ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/console/empty-state';
import { getDunningView, type Branch } from '@/lib/dunning';

const stageTone: Record<'neutral' | 'success' | 'danger', string> = {
  neutral: 'text-subtle-foreground',
  success: 'text-success',
  danger: 'text-danger',
};
const BRANCH: Record<Branch, { label: string; bg: string; text: string; dot: string }> = {
  card_update: { label: 'card update', bg: 'bg-info-bg', text: 'text-info', dot: 'bg-info' },
  reschedule: { label: 'reschedule', bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning' },
  short_path: { label: 'short path', bg: 'bg-surface-2', text: 'text-muted-foreground', dot: 'bg-subtle-foreground' },
};

export default async function DunningPage() {
  const { kpis, funnel, railRecovery, worklist, hasActivity } = await getDunningView();

  const kpiCards = [
    { label: 'RECOVERY RATE', value: kpis.recoveryRate, delta: 'succeeded of resolved', tone: kpis.recoveryRateTone },
    { label: 'FAILED CHARGE RATE', value: '—', delta: 'appears once billed', tone: 'muted' as const },
    { label: 'RECOVERED, 30 DAYS', value: kpis.recoveredShort, delta: `across ${kpis.recoveredCount} subscription${kpis.recoveredCount === 1 ? '' : 's'}`, tone: 'success' as const },
    { label: 'AT RISK NOW', value: kpis.atRiskShort, delta: `${kpis.inRecovery} in recovery`, tone: 'warning' as const },
  ];

  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Dunning and recovery</h1>

      {/* KPIs */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {kpiCards.map((k) => (
          <div key={k.label} className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-surface-1 px-[18px] py-4">
            <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">{k.label}</span>
            <span className="text-[26px] font-semibold tracking-[-0.5px] text-foreground">{k.value}</span>
            <span className={`text-[12px] ${k.tone === 'success' ? 'text-success' : k.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>
              {k.delta}
            </span>
          </div>
        ))}
      </div>

      {/* Mid: funnel + recovery by rail */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Funnel */}
        <div className="flex flex-1 flex-col gap-[14px] rounded-lg border border-border bg-surface-1 p-[18px]">
          <span className="text-[15px] font-semibold text-foreground">Recovery funnel, this cycle</span>
          <div className="flex items-center gap-1">
            {funnel.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <div className="flex w-full flex-col items-center gap-1 rounded bg-surface-2 px-1.5 py-3">
                  <span className={`text-[19px] font-semibold ${stageTone[s.tone]}`}>{s.value}</span>
                  <span className="font-mono text-[9.5px] text-subtle-foreground">{s.label}</span>
                </div>
                {i < funnel.length - 1 ? <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" strokeWidth={1.75} /> : null}
              </div>
            ))}
          </div>
          <span className="text-[11.5px] text-subtle-foreground">
            Rescheduled retries are payday-timed. Card-update and OTP holds never blind-retry.
          </span>
        </div>

        {/* Recovery by rail */}
        <div className="flex w-full lg:w-[392px] lg:shrink-0 flex-col gap-[14px] rounded-lg border border-border bg-surface-1 p-[18px]">
          <span className="text-[15px] font-semibold text-foreground">Recovered by rail</span>
          {railRecovery.map((r) => (
            <div key={r.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">{r.name}</span>
                <span className="font-mono text-[13px] font-medium text-foreground">{r.amount}</span>
              </div>
              <div className="h-[7px] w-full overflow-hidden rounded-full bg-surface-3">
                <div className={`h-full rounded-full ${r.c}`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Worklist */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <span className="text-[16px] font-semibold text-foreground">In recovery, sorted by amount at risk</span>
        {worklist.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            iconTone="accent"
            title={hasActivity ? 'Nothing in recovery' : 'No dunning activity yet'}
            titleSize={16}
            description={
              hasActivity
                ? 'Every subscription is billing cleanly right now.\nFailed charges will surface here for triage.'
                : 'When a charge fails, the engine opens a recovery track\nhere — payday-timed retries, card-update holds, and OTP links.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
            <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-[11px] font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
              <span className="flex-1">SUBSCRIPTION</span>
              <span className="w-[100px] text-right">AT RISK</span>
              <span className="w-[154px]">BRANCH</span>
              <span className="w-[70px]">ATTEMPT</span>
              <span className="w-[120px]">NEXT / GRACE</span>
              <span className="w-[190px]" />
            </div>
            {worklist.map((r, i) => {
              const b = BRANCH[r.branch];
              return (
                <div
                  key={r.reference}
                  className={`flex min-w-[900px] items-center gap-[14px] px-4 py-[11px] ${i < worklist.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-foreground">{r.name}</span>
                    <span className="truncate text-[11px] text-subtle-foreground">{r.plan}</span>
                  </div>
                  <span className="w-[100px] text-right font-mono text-[13px] text-foreground">{r.atRisk}</span>
                  <div className="w-[154px]">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${b.bg}`}>
                      <span className={`size-1.5 rounded-full ${b.dot}`} />
                      <span className={`font-mono text-[11px] ${b.text}`}>{b.label}</span>
                    </span>
                  </div>
                  <span className="w-[70px] font-mono text-[12.5px] text-muted-foreground">{r.attempt}</span>
                  <div className="flex w-[120px] flex-col gap-0.5">
                    <span className="text-[12.5px] text-foreground">{r.next}</span>
                    <span className={`text-[10.5px] ${r.graceTone === 'warning' ? 'text-warning' : r.graceTone === 'danger' ? 'text-danger' : 'text-muted-foreground'}`}>
                      {r.grace}
                    </span>
                  </div>
                  <div className="flex w-[190px] justify-end">
                    <Link
                      href={`/subscriptions/${r.subscriptionReference}`}
                      title={`${r.action} — the engine runs this step automatically; open the subscription's recovery cockpit to update the card.`}
                      className="rounded-sm border border-border-strong bg-surface-2 px-2.5 py-[5px] text-[12px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-3"
                    >
                      {r.action}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
