import { Download, ChevronDown, Copy, Check } from 'lucide-react';

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

const breakdown = [
  { label: 'Subtotal', value: '₦18,000', divTop: false, bold: false },
  { label: 'Discount', value: '−₦0', divTop: false, bold: false },
  { label: 'Credit applied', value: '−₦0', divTop: false, bold: false },
  { label: 'Amount due', value: '₦18,000', divTop: true, bold: true },
  { label: 'Amount paid', value: '₦18,000', divTop: true, bold: false },
  { label: 'Amount remaining', value: '₦0', divTop: false, bold: false, good: true },
];

const lineItems = [{ desc: 'Pro Monthly · 1 Oct – 1 Nov', qty: '1', amount: '₦18,000' }];

const legs = [
  { account: 'Customer receivable', debit: '₦18,000', credit: '—' },
  { account: 'Subscription revenue', debit: '—', credit: '₦18,000' },
];

const split = [
  { grow: 450, c: 'bg-accent' },
  { grow: 17550, c: 'bg-success' },
];
const legend = [
  { dot: 'bg-foreground', label: 'gross ₦18,000' },
  { dot: 'bg-accent', label: 'fee ₦450' },
  { dot: 'bg-success', label: 'net ₦17,550' },
];

const details = [
  { label: 'Status', value: 'Paid', tone: 'success' as const },
  { label: 'Customer', value: 'Kola Retail' },
  { label: 'Subscription', value: 'nbo749…sub' },
  { label: 'Reason', value: 'subscription_cycle' },
  { label: 'Currency', value: 'NGN' },
  { label: 'Issued', value: '1 Oct 2026' },
];
const payment = [
  { label: 'Method', value: 'Visa ·4242' },
  { label: 'Rail', value: 'Card' },
  { label: 'Paid at', value: '1 Oct, 14:22' },
  { label: 'Reference', value: 'nbo749…txn' },
];

function Fields({ rows }: { rows: { label: string; value: string; tone?: 'success' }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((f, i) => (
        <div
          key={f.label}
          className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
        >
          <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
          <span className={`text-[12.5px] font-medium ${f.tone === 'success' ? 'text-success' : 'text-foreground'}`}>
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">₦18,000</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[12px] font-medium text-success">Paid</span>
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            nbo749201835566inv · Kola Retail · Pro Monthly · cycle 4
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
            <Download className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
            Download PDF
          </button>
          <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
            Actions
            <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-col lg:flex-row min-h-0 flex-1 gap-[18px]">
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Amount breakdown */}
          <CardShell className="flex flex-col gap-3 p-[18px]">
            <span className="text-[15px] font-semibold text-foreground">Amount breakdown</span>
            <div className="flex flex-col gap-[9px]">
              {breakdown.map((r) => (
                <div key={r.label}>
                  {r.divTop ? <div className="mb-[9px] h-px w-full bg-border" /> : null}
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] ${r.bold ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {r.label}
                    </span>
                    <span
                      className={`font-mono text-[13.5px] ${r.bold ? 'font-medium' : ''} ${r.good ? 'text-success' : 'text-foreground'}`}
                    >
                      {r.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Line items */}
          <CardShell className="flex flex-col gap-3 p-[18px]">
            <span className="text-[15px] font-semibold text-foreground">Line items</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-[14px] border-b border-border pb-2 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
                <span className="flex-1">DESCRIPTION</span>
                <span className="w-[130px]">QTY</span>
                <span className="w-[110px] text-right">AMOUNT</span>
              </div>
              {lineItems.map((l, i) => (
                <div key={i} className="flex items-center gap-[14px] py-2.5">
                  <span className="flex-1 text-[13px] text-foreground">{l.desc}</span>
                  <span className="w-[130px] text-[13px] text-muted-foreground">{l.qty}</span>
                  <span className="w-[110px] text-right font-mono text-[13px] text-foreground">{l.amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-[13px] font-semibold text-foreground">Total</span>
                <span className="font-mono text-[13.5px] font-semibold text-foreground">₦18,000</span>
              </div>
            </div>
          </CardShell>

          {/* Ledger receipt (double-entry) */}
          <CardShell className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Ledger receipt</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-[9px] py-[3px]">
                <Check className="size-3 text-success" strokeWidth={2.5} />
                <span className="text-[11.5px] font-medium text-success">Balanced</span>
              </span>
            </div>

            {/* Charge entry */}
            <span className="font-mono text-[11.5px] text-subtle-foreground">charge · nbo749201835566txn</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-[14px] pb-1.5 font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">
                <span className="flex-1">ACCOUNT</span>
                <span className="w-[110px] text-right">DEBIT</span>
                <span className="w-[110px] text-right">CREDIT</span>
              </div>
              {legs.map((l, i) => (
                <div key={i} className="flex items-center gap-[14px] py-[7px]">
                  <span className="flex-1 text-[12.5px] text-foreground">{l.account}</span>
                  <span className={`w-[110px] text-right font-mono text-[12.5px] ${l.debit === '—' ? 'text-subtle-foreground' : 'text-foreground'}`}>
                    {l.debit}
                  </span>
                  <span className={`w-[110px] text-right font-mono text-[12.5px] ${l.credit === '—' ? 'text-subtle-foreground' : 'text-foreground'}`}>
                    {l.credit}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-px w-full bg-border" />

            {/* Settlement split */}
            <span className="font-mono text-[11.5px] text-subtle-foreground">
              settlement · nbo749201835566txn — gross splits into fee and net
            </span>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
              {split.map((s, i) => (
                <div key={i} className={s.c} style={{ flexGrow: s.grow }} />
              ))}
            </div>
            <div className="flex items-center gap-[18px]">
              {legend.map((l) => (
                <div key={l.label} className="flex items-center gap-[7px]">
                  <span className={`size-2 rounded-full ${l.dot}`} />
                  <span className="text-[12px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-subtle-foreground">
              Immutable. A correction posts a new reversing entry, never an edit.
            </span>
          </CardShell>
        </div>

        {/* Right */}
        <div className="flex w-full lg:w-[344px] lg:shrink-0 flex-col gap-4">
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[14px] font-semibold text-foreground">Details</span>
            <Fields rows={details} />
          </CardShell>

          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[14px] font-semibold text-foreground">Payment</span>
            <Fields rows={payment} />
          </CardShell>

          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-foreground">Reproduce this</span>
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
                <span className="font-mono text-[12px] text-foreground">await nomba.invoices</span>
                <span className="font-mono text-[12px] text-accent">{'  .retrieve("nbo749201835566inv")'}</span>
              </div>
              <Copy className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
