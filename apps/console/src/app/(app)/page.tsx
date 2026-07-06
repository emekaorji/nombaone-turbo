import { Plus, ArrowUp, ArrowDown, Pause } from 'lucide-react';

/* ── demo data, shaped like the real DTOs (BillingMetricsData, dunning, events) ── */

type Tone = 'success' | 'danger' | 'accent';
const movement: { label: string; value: string; dir: 'up' | 'down'; tone: Tone; h: number }[] = [
  { label: 'New', value: '+₦320k', dir: 'up', tone: 'success', h: 40 },
  { label: 'Expansion', value: '+₦140k', dir: 'up', tone: 'success', h: 24 },
  { label: 'Contraction', value: '−₦40k', dir: 'down', tone: 'danger', h: 12 },
  { label: 'Churn', value: '−₦120k', dir: 'down', tone: 'danger', h: 18 },
  { label: 'Net', value: '+₦300k', dir: 'up', tone: 'accent', h: 34 },
];

const segments: { label: string; value: string; warn?: boolean }[] = [
  { label: 'Active', value: '1,284' },
  { label: 'Trialing', value: '52' },
  { label: 'In recovery', value: '37', warn: true },
  { label: 'At risk', value: '₦1.14M', warn: true },
];

const funnel: { value: string; label: string; good?: boolean }[] = [
  { value: '52', label: 'scheduled' },
  { value: '8', label: 'attempting' },
  { value: '14', label: 'card update' },
  { value: '88', label: 'recovered', good: true },
];

const atRisk = [
  { name: 'Uche Media', meta: 'Annual Pro · ₦120,000', status: 'OTP required, link sent', action: 'Copy link' },
  { name: 'Bola Foods', meta: 'Growth · ₦40,000', status: 'Retry scheduled · payday 26 Sep', action: 'Update card' },
  { name: 'Zed Studio', meta: 'Starter · ₦18,000', status: 'Awaiting customer card update', action: 'Resend' },
];

type Ev = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
const events: { type: string; tone: Ev; detail: string; time: string; live?: boolean }[] = [
  { type: 'invoice.payment_recovered', tone: 'success', detail: 'nbo749…inv · ₦9,800', time: 'now', live: true },
  { type: 'subscription.created', tone: 'neutral', detail: 'nbo2f1…cus · Growth', time: '12s' },
  { type: 'invoice.payment_failed', tone: 'danger', detail: 'nboa30…inv · ₦40,000', time: '40s' },
  { type: 'customer.updated', tone: 'neutral', detail: 'nbo9c2…cus', time: '1m' },
  { type: 'invoice.finalized', tone: 'info', detail: 'nbo55b…inv · ₦120,000', time: '2m' },
  { type: 'dunning.attempt_scheduled', tone: 'warning', detail: 'nbo18d…sub · payday', time: '3m' },
  { type: 'payout.created', tone: 'neutral', detail: 'nbo7ff…pay · ₦2.4M', time: '5m' },
];

const barFill: Record<Tone, string> = { success: 'bg-success', danger: 'bg-danger', accent: 'bg-accent' };
const vrText: Record<Tone, string> = { success: 'text-success', danger: 'text-danger', accent: 'text-accent' };
const evDot: Record<Ev, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-subtle-foreground',
};
const evText: Record<Ev, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-foreground',
};

export default function OverviewPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Page header — desktop only (mobile shows the section in the topbar) */}
      <div className="hidden items-center justify-between lg:flex">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Overview</h1>
          <p className="text-[14px] text-muted-foreground">
            Acme Ltd, sandbox mode. Your recurring revenue at a glance, and what needs you.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          New subscription
        </button>
      </div>

      {/* ── MOBILE layout (VD6Qh) ── */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        {/* MRR card */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">MRR</span>
            <span className="flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5">
              <ArrowUp className="size-[11px] text-success" strokeWidth={2.5} />
              <span className="text-[11px] font-medium text-success">12.4%</span>
            </span>
          </div>
          <span className="text-[34px] font-semibold leading-none tracking-[-1px] text-foreground">₦4.82M</span>
          <span className="text-[12px] text-muted-foreground">
            New +₦320k · Expansion +₦140k · Churn −₦120k · Net +₦300k
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
              <span className="text-[11.5px] font-medium text-warning">₦1.14M at risk</span>
            </span>
          </div>
          {atRisk.slice(0, 2).map((r, i) => (
            <div
              key={r.name}
              className={`flex items-center justify-between gap-2.5 py-[11px] ${i < 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium text-foreground">{r.name}</span>
                <span className="truncate text-[11.5px] text-warning">{r.status}</span>
              </div>
              <button className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-[11px] py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                {r.action}
              </button>
            </div>
          ))}
        </div>

        {/* Live */}
        <div className="flex flex-col rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-[14.5px] font-semibold text-foreground">Live</span>
            <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-[7px] py-0.5">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[10.5px] font-medium text-success">streaming</span>
            </span>
          </div>
          {events.map((e, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 py-[9px] ${i < events.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className={`size-[7px] shrink-0 rounded-full ${evDot[e.tone]}`} />
              <span className={`min-w-0 flex-1 truncate font-mono text-[12px] ${evText[e.tone]}`}>{e.type}</span>
              <span className="shrink-0 text-[11.5px] text-subtle-foreground">{e.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:contents">
      {/* Revenue command bar */}
      <div className="flex items-center gap-[26px] rounded-lg border border-border bg-surface-1 px-6 py-5">
        {/* MRR */}
        <div className="flex w-[210px] shrink-0 flex-col gap-[5px]">
          <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">MRR</span>
          <span className="text-[36px] font-semibold leading-none tracking-[-1px] text-foreground">₦4.82M</span>
          <span className="text-[13px] text-success">▲ 12.4% · 30 days</span>
        </div>
        <div className="h-[92px] w-px shrink-0 bg-border" />
        {/* Movement waterfall */}
        <div className="flex flex-1 flex-col gap-3">
          <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            MRR MOVEMENT · 30 DAYS
          </span>
          <div className="flex items-end justify-between">
            {movement.map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1.5">
                <div className={`w-[26px] rounded-[3px] ${barFill[m.tone]}`} style={{ height: m.h }} />
                <div className={`flex items-center gap-[3px] ${vrText[m.tone]}`}>
                  {m.dir === 'up' ? <ArrowUp className="size-3" strokeWidth={2.25} /> : <ArrowDown className="size-3" strokeWidth={2.25} />}
                  <span className="text-[13px] font-semibold">{m.value}</span>
                </div>
                <span className="font-mono text-[10px] text-subtle-foreground">{m.label}</span>
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
                <span className="text-[11.5px] font-medium text-warning">₦1.14M at risk</span>
              </span>
            </div>
            <button className="text-[13px] text-accent hover:underline">Open recovery</button>
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
          {atRisk.map((r, i) => (
            <div
              key={r.name}
              className={`flex items-center justify-between gap-3 px-0.5 py-[11px] ${i < atRisk.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{r.name}</span>
                  <span className="text-[12px] text-muted-foreground">{r.meta}</span>
                </div>
                <span className="text-[11.5px] text-warning">{r.status}</span>
              </div>
              <button className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-2.5 py-[5px] text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3">
                {r.action}
              </button>
            </div>
          ))}
        </div>

        {/* Live card */}
        <div className="flex w-[404px] shrink-0 flex-col gap-0.5 overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold text-foreground">Live</span>
              <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-success" />
                <span className="text-[10.5px] font-medium text-success">streaming</span>
              </span>
            </div>
            <Pause className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
          </div>

          {events.map((e, i) => (
            <div
              key={i}
              className={`flex items-center gap-[11px] py-[9px] ${i < events.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${evDot[e.tone]}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-[7px]">
                  <span className={`truncate font-mono text-[12px] ${evText[e.tone]}`}>{e.type}</span>
                  {e.live ? (
                    <span className="flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-px">
                      <span className="text-[9px] font-medium uppercase text-success">live</span>
                    </span>
                  ) : null}
                </div>
                <span className="truncate font-mono text-[10.5px] text-subtle-foreground">{e.detail}</span>
              </div>
              <span className="shrink-0 text-[11.5px] text-subtle-foreground">{e.time}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
