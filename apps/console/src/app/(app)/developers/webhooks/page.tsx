import { Plus, Globe } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';

const stats = [
  { value: '1,240', label: 'Delivered, 24h' },
  { value: '0', label: 'Failing' },
  { value: '0', label: 'Pending' },
  { value: '214ms', label: 'Avg latency' },
];

type DStatus = 'delivered' | 'pending' | 'failed';
type Row = { type: string; ref: string; status: DStatus; attempts: string; response: string; responseTone?: 'danger'; time: string; replay: boolean };
const deliveries: Row[] = [
  { type: 'invoice.action_required', ref: 'whd_7d4a2f · evt_9c1b', status: 'pending', attempts: '0', response: '—', time: 'now', replay: false },
  { type: 'invoice.payment_failed', ref: 'whd_2b8e10 · evt_4a1f', status: 'failed', attempts: '3 / 3', response: '503', responseTone: 'danger', time: '12m', replay: true },
  { type: 'subscription.created', ref: 'whd_9c1b7d · evt_2f8c', status: 'delivered', attempts: '1', response: '200', time: '18m', replay: false },
  { type: 'invoice.payment_recovered', ref: 'whd_5c2b9e · evt_7d4a', status: 'delivered', attempts: '2', response: '200', time: '40m', replay: false },
  { type: 'customer.updated', ref: 'whd_1f8c6b · evt_9e7d', status: 'delivered', attempts: '1', response: '200', time: '1h', replay: false },
  { type: 'payout.created', ref: 'whd_7f3d9a · evt_c8e1', status: 'delivered', attempts: '1', response: '200', time: '2h', replay: false },
];

const DSTATUS: Record<DStatus, { label: string; text: string; bg: string; dot: string }> = {
  delivered: { label: 'Delivered', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  pending: { label: 'Pending', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  failed: { label: 'Failed', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
};

export default function WebhooksPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          Add endpoint
        </button>
      </div>

      <DeveloperTabs />

      {/* Endpoint card */}
      <div className="flex flex-col gap-[14px] rounded-lg border border-border bg-surface-1 p-[18px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="size-[17px] text-muted-foreground" strokeWidth={1.75} />
            <span className="font-mono text-[14px] font-medium text-foreground">https://api.acme.io/webhooks/nomba</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-[9px] py-[3px]">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[12px] font-medium text-success">Active</span>
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <button className="rounded border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-border-strong">
              Send test
            </button>
            <button className="rounded border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-border-strong">
              Edit
            </button>
          </div>
        </div>
        <p className="truncate font-mono text-[11.5px] text-subtle-foreground">
          Signing secret whsec_ab12••••7f · 32 of 34 events enabled + wildcard · x-nombaone-delivery-guarantee:
          at-least-once
        </p>
        <div className="h-px w-full bg-border" />
        <div className="flex items-center">
          {stats.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[18px] font-semibold text-foreground">{s.value}</span>
                <span className="text-[11.5px] text-muted-foreground">{s.label}</span>
              </div>
              {i < stats.length - 1 ? <div className="h-[34px] w-px bg-border" /> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Recent deliveries */}
      <span className="text-[16px] font-semibold text-foreground">Recent deliveries</span>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">EVENT</span>
          <span className="w-[130px]">STATUS</span>
          <span className="w-[90px]">ATTEMPTS</span>
          <span className="w-[120px]">RESPONSE</span>
          <span className="w-[90px]">TIME</span>
          <span className="w-[80px]" />
        </div>
        {deliveries.map((d, i) => {
          const s = DSTATUS[d.status];
          return (
            <div key={i} className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < deliveries.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-[12.5px] text-foreground">{d.type}</span>
                <span className="truncate font-mono text-[11px] text-subtle-foreground">{d.ref}</span>
              </div>
              <div className="w-[130px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                </span>
              </div>
              <span className="w-[90px] font-mono text-[12.5px] text-muted-foreground">{d.attempts}</span>
              <span className={`w-[120px] font-mono text-[12.5px] ${d.responseTone === 'danger' ? 'text-danger' : d.response === '—' ? 'text-subtle-foreground' : 'text-muted-foreground'}`}>
                {d.response}
              </span>
              <span className="w-[90px] text-[12.5px] text-muted-foreground">{d.time}</span>
              <div className="w-[80px]">
                {d.replay ? (
                  <button className="rounded-sm border border-border-strong bg-surface-2 px-2.5 py-[5px] text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3">
                    Replay
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
