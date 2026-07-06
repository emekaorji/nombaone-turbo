import { CircleCheck, CircleX, ShieldCheck, Timer } from 'lucide-react';

const stats = [
  { value: '₦8.1M', label: 'Reconciled, 30 days', tone: 'text-foreground' },
  { value: '1,204', label: 'Settlements matched', tone: 'text-foreground' },
  { value: '3', label: 'Awaiting match', tone: 'text-warning' },
  { value: '0', label: 'Mismatches', tone: 'text-success' },
];

type Ver = 'matched' | 'awaiting' | 'failed';
type St = 'reconciled' | 'pending' | 'failed';
type Row = { customer: string; ref: string; ver: Ver; amount: string; status: St };
const rows: Row[] = [
  { customer: 'Kola Retail', ref: 'nbo749201835566inv', ver: 'matched', amount: '₦18,000', status: 'reconciled' },
  { customer: 'Mira Ltd', ref: 'nbo662019930014inv', ver: 'matched', amount: '₦150,000', status: 'reconciled' },
  { customer: 'Ada Obi', ref: 'nbo120983745610inv', ver: 'matched', amount: '₦12,000', status: 'reconciled' },
  { customer: 'Bola Foods', ref: 'nbo403915662210inv', ver: 'awaiting', amount: '—', status: 'pending' },
  { customer: 'Uche Media', ref: 'nbo930014662019inv', ver: 'failed', amount: '—', status: 'failed' },
];

const VER: Record<Ver, { icon: typeof CircleCheck; text: string; color: string }> = {
  matched: { icon: CircleCheck, text: 'amount = due', color: 'text-success' },
  awaiting: { icon: Timer, text: 'awaiting webhook', color: 'text-warning' },
  failed: { icon: CircleX, text: 'verification failed', color: 'text-danger' },
};
const STATUS: Record<St, { label: string; bg: string; dot: string; text: string }> = {
  reconciled: { label: 'Reconciled', bg: 'bg-success-bg', dot: 'bg-success', text: 'text-success' },
  pending: { label: 'Pending', bg: 'bg-warning-bg', dot: 'bg-warning', text: 'text-warning' },
  failed: { label: 'Failed', bg: 'bg-danger-bg', dot: 'bg-danger', text: 'text-danger' },
};

export default function ReconciliationPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Reconciliation</h1>
        <p className="text-[14px] text-muted-foreground">
          Proof the money is right. Every settlement matched by your reference and verified against Nomba, to the kobo.
        </p>
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className={`text-[20px] font-semibold tracking-[-0.3px] ${s.tone}`}>{s.value}</span>
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
            </div>
            {i < stats.length - 1 ? <div className="h-[38px] w-px bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Explainer */}
      <div className="flex items-center gap-[11px] rounded-lg border border-accent-border bg-accent-muted px-4 py-[13px]">
        <ShieldCheck className="size-[17px] shrink-0 text-accent" strokeWidth={1.75} />
        <p className="text-[12.5px] text-foreground">
          We never trust a webhook. Each settlement re-queries Nomba and posts only when the transaction is settled and
          the settled amount equals the amount due. Matched by your reference, never Nomba&apos;s rotating id.
        </p>
      </div>

      {/* Provenance table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">INVOICE / CUSTOMER</span>
          <span className="w-[210px]">YOUR REFERENCE</span>
          <span className="w-[210px]">VERIFIED</span>
          <span className="w-[110px] text-right">SETTLED</span>
          <span className="w-[120px]">STATUS</span>
        </div>
        {rows.map((r, i) => {
          const v = VER[r.ver];
          const s = STATUS[r.status];
          const VerIcon = v.icon;
          return (
            <div
              key={r.ref}
              className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{r.customer}</span>
              <span className="w-[210px] font-mono text-[11.5px] text-subtle-foreground">{r.ref}</span>
              <div className={`flex w-[210px] items-center gap-[7px] ${v.color}`}>
                <VerIcon className="size-[15px] shrink-0" strokeWidth={1.75} />
                <span className="text-[12.5px]">{v.text}</span>
              </div>
              <span className="w-[110px] text-right font-mono text-[13px] text-foreground">{r.amount}</span>
              <div className="w-[120px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gap note */}
      <p className="text-[11.5px] text-subtle-foreground">
        Cross-tenant drift and ledger-integrity checks are operator tools in Admin. This view shows your own settled
        truth, verified against Nomba.
      </p>
    </div>
  );
}
