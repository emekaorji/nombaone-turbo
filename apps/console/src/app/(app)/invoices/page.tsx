import Link from 'next/link';
import { Download, ChevronDown, Columns3 } from 'lucide-react';

type Status = 'paid' | 'open' | 'partially_paid' | 'uncollectible' | 'void';
type Row = {
  id: string;
  meta: string;
  customer: string;
  amount: string;
  status: Status;
  cap?: { text: string; tone: 'warning' | 'muted' };
  progress?: { pct: number; text: string };
  reason: string;
  issued: string;
};

const stats = [
  { value: '₦8.2M', label: 'Collected, 30 days', tone: 'foreground' as const },
  { value: '₦420k', label: 'Outstanding', tone: 'foreground' as const },
  { value: '₦140k', label: 'Overdue', tone: 'warning' as const },
  { value: '₦60k', label: 'Uncollectible', tone: 'danger' as const },
];

const tabs = [
  { label: 'All', active: true },
  { label: 'Open · 46', active: false },
  { label: 'Past due · 12', active: false },
  { label: 'Partially paid · 5', active: false },
  { label: 'Paid', active: false },
  { label: 'Uncollectible · 3', active: false },
];

const rows: Row[] = [
  { id: 'nbo749201835566inv', meta: 'cycle 4 · Pro Monthly', customer: 'Kola Retail', amount: '₦18,000', status: 'paid', reason: 'subscription_cycle', issued: '1 Oct' },
  { id: 'nbo55b920140093inv', meta: 'cycle 9 · Scale', customer: 'Mira Ltd', amount: '₦18,000', status: 'partially_paid', progress: { pct: 55, text: '₦9,900 of ₦18,000' }, reason: 'subscription_cycle', issued: '28 Sep' },
  { id: 'nbo2mp901835566inv', meta: 'cycle 3 · Team Monthly', customer: 'Bola Foods', amount: '₦40,000', status: 'open', cap: { text: 'overdue 12d · in dunning', tone: 'warning' }, reason: 'subscription_cycle', issued: '16 Sep' },
  { id: 'nbo8fk201835566inv', meta: 'cycle 2 · Annual Pro', customer: 'Uche Media', amount: '₦120,000', status: 'open', cap: { text: 'action required · OTP link sent', tone: 'warning' }, reason: 'subscription_cycle', issued: '20 Sep' },
  { id: 'nbop04201835566inv', meta: 'cycle 7 · Starter', customer: 'Zed Studio', amount: '₦1,500', status: 'paid', reason: 'subscription_cycle', issued: '4 Sep' },
  { id: 'nbo18d201835566inv', meta: 'one-off · setup', customer: 'Pau Ade', amount: '₦25,000', status: 'open', cap: { text: 'due in 3 days', tone: 'muted' }, reason: 'one_off', issued: '1 Oct' },
  { id: 'nbo7ff201835566inv', meta: 'cycle 5 · Growth', customer: 'Tobi Co', amount: '₦40,000', status: 'paid', reason: 'subscription_cycle', issued: '12 Sep' },
  { id: 'nboa30201835566inv', meta: 'cycle 6 · Starter', customer: 'Nia Books', amount: '₦1,500', status: 'uncollectible', cap: { text: 'written off 30 Sep', tone: 'warning' }, reason: 'subscription_cycle', issued: '1 Aug' },
];

const STATUS: Record<Status, { label: string; text: string; bg: string; dot: string }> = {
  paid: { label: 'Paid', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  open: { label: 'Open', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  partially_paid: { label: 'Partially paid', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  uncollectible: { label: 'Uncollectible', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
  void: { label: 'Void', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
};

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-5 px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Invoices</h1>
          <p className="text-[14px] text-muted-foreground">
            Engine-issued. Status is derived from the ledger, so it never drifts from the money.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
          <Download className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Export
        </button>
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span
                className={`text-[20px] font-semibold tracking-[-0.3px] ${s.tone === 'warning' ? 'text-warning' : s.tone === 'danger' ? 'text-danger' : 'text-foreground'}`}
              >
                {s.value}
              </span>
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
            </div>
            {i < stats.length - 1 ? <div className="h-[38px] w-px bg-border" /> : null}
          </div>
        ))}
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
          <span className="text-[12px] text-subtle-foreground">Sorted by issued date</span>
          <ChevronDown className="size-[14px] text-subtle-foreground" strokeWidth={1.75} />
          <button className="flex size-[30px] items-center justify-center rounded border border-border text-subtle-foreground transition-colors hover:text-foreground">
            <Columns3 className="size-[15px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">INVOICE</span>
          <span className="w-[150px]">CUSTOMER</span>
          <span className="w-[110px] text-right">AMOUNT</span>
          <span className="w-[160px]">STATUS</span>
          <span className="w-[140px]">REASON</span>
          <span className="w-[90px]">ISSUED</span>
        </div>

        {rows.map((r, i) => {
          const s = STATUS[r.status];
          return (
            <Link
              key={r.id}
              href={`/invoices/${r.id}`}
              className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
                i < rows.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {/* Invoice */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-[13px] font-medium text-foreground">{r.id}</span>
                <span className="truncate text-[11px] text-subtle-foreground">{r.meta}</span>
              </div>

              {/* Customer */}
              <div className="w-[150px]">
                <span className="text-[13px] text-muted-foreground">{r.customer}</span>
              </div>

              {/* Amount */}
              <div className="w-[110px] text-right">
                <span className="font-mono text-[13px] text-foreground">{r.amount}</span>
              </div>

              {/* Status */}
              <div className="flex w-[160px] flex-col gap-[5px]">
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                </span>
                {r.progress ? (
                  <div className="flex flex-col gap-1 pr-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${r.progress.pct}%` }} />
                    </div>
                    <span className="text-[11px] text-subtle-foreground">{r.progress.text}</span>
                  </div>
                ) : r.cap ? (
                  <span className={`text-[11px] ${r.cap.tone === 'warning' ? 'text-warning' : 'text-subtle-foreground'}`}>
                    {r.cap.text}
                  </span>
                ) : null}
              </div>

              {/* Reason */}
              <div className="w-[140px]">
                <span className="font-mono text-[11.5px] text-subtle-foreground">{r.reason}</span>
              </div>

              {/* Issued */}
              <div className="w-[90px]">
                <span className="text-[12.5px] text-muted-foreground">{r.issued}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
