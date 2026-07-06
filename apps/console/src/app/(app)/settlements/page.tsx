import { Banknote } from 'lucide-react';

const escrow = [
  { label: 'Balance', value: '₦2.15M', bold: false, tone: 'default' as const },
  { label: 'Locked in escrow', value: '₦400,000', bold: false, tone: 'warning' as const },
  { label: 'Refund buffer', value: '₦30,000', bold: false, tone: 'default' as const },
];
const bar = [
  { grow: 1720, c: 'bg-accent' },
  { grow: 400, c: 'bg-warning' },
  { grow: 30, c: 'bg-surface-3' },
];

type SStatus = 'settled' | 'reconciled' | 'pending' | 'refunded' | 'failed';
type Row = { customer: string; inv: string; gross: string; fee: string; net: string; status: SStatus; settled: string };
const rows: Row[] = [
  { customer: 'Mira Ltd', inv: 'nbo662…inv', gross: '₦150,000', fee: '₦3,750', net: '₦146,250', status: 'settled', settled: '1 Oct' },
  { customer: 'Kola Retail', inv: 'nbo749…inv', gross: '₦18,000', fee: '₦450', net: '₦17,550', status: 'reconciled', settled: '1 Oct' },
  { customer: 'Bola Foods', inv: 'nbo2mp…inv', gross: '₦40,000', fee: '₦1,000', net: '₦39,000', status: 'pending', settled: '3 Oct' },
  { customer: 'Ada Obi', inv: 'nbo9c2…inv', gross: '₦40,000', fee: '₦1,000', net: '₦39,000', status: 'settled', settled: '30 Sep' },
  { customer: 'Zed Studio', inv: 'nbop04…inv', gross: '₦1,500', fee: '₦38', net: '₦1,462', status: 'settled', settled: '28 Sep' },
  { customer: 'Uche Media', inv: 'nbo8fk…inv', gross: '₦120,000', fee: '₦3,000', net: '₦117,000', status: 'refunded', settled: '26 Sep' },
];

const STATUS: Record<SStatus, { label: string; text: string; bg: string; dot: string }> = {
  settled: { label: 'Settled', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  reconciled: { label: 'Reconciled', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  pending: { label: 'Pending', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  refunded: { label: 'Refunded', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
  failed: { label: 'Failed', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
};

export default function SettlementsPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Settlements and payouts</h1>

      {/* Escrow hero */}
      <div className="flex items-center gap-7 rounded-lg border border-border bg-surface-1 px-6 py-[22px]">
        <div className="flex w-[280px] shrink-0 flex-col gap-[14px]">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">AVAILABLE TO WITHDRAW</span>
            <span className="text-[38px] font-semibold leading-none tracking-[-1px] text-accent">₦1.72M</span>
          </div>
          <button className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover">
            <Banknote className="size-4" strokeWidth={2} />
            Withdraw to bank
          </button>
        </div>

        <div className="h-[120px] w-px shrink-0 bg-border" />

        <div className="flex flex-1 flex-col gap-2.5">
          {escrow.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">{r.label}</span>
              <span className={`font-mono text-[13.5px] ${r.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>{r.value}</span>
            </div>
          ))}
          <div className="h-px w-full bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Available</span>
            <span className="font-mono text-[13.5px] font-semibold text-accent">₦1.72M</span>
          </div>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {bar.map((s, i) => (
              <div key={i} className={s.c} style={{ flexGrow: s.grow }} />
            ))}
          </div>
          <span className="text-[11.5px] text-subtle-foreground">
            The 3-hour lock is a refund buffer, so a just-collected payment can be reversed. Platform fees are
            earned and non-refundable.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        <button className="rounded bg-surface-2 px-3.5 py-1.5 text-[13px] font-medium text-foreground">Settlements</button>
        <button className="rounded px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          Payouts
        </button>
      </div>

      {/* Settlements table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">INVOICE / CUSTOMER</span>
          <span className="w-[120px] text-right">GROSS</span>
          <span className="w-[100px] text-right">FEE</span>
          <span className="w-[130px] text-right">NET TO YOU</span>
          <span className="w-[130px]">STATUS</span>
          <span className="w-[90px]">SETTLED</span>
        </div>
        {rows.map((r, i) => {
          const s = STATUS[r.status];
          return (
            <div
              key={r.customer}
              className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium text-foreground">{r.customer}</span>
                <span className="truncate font-mono text-[11px] text-subtle-foreground">{r.inv}</span>
              </div>
              <span className="w-[120px] text-right font-mono text-[13px] text-foreground">{r.gross}</span>
              <span className="w-[100px] text-right font-mono text-[13px] text-muted-foreground">−{r.fee}</span>
              <span className="w-[130px] text-right font-mono text-[13px] font-medium text-foreground">{r.net}</span>
              <div className="w-[130px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                </span>
              </div>
              <span className="w-[90px] text-[12.5px] text-muted-foreground">{r.settled}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
