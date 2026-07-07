export const dynamic = 'force-dynamic';

import { CircleCheck, CircleX, ShieldCheck, Timer } from 'lucide-react';

import { EmptyState } from '@/components/console/empty-state';
import { getReconciliationView, type Verification, type ReconStatus } from '@/lib/reconciliation';

const VER: Record<Verification, { icon: typeof CircleCheck; text: string; color: string }> = {
  matched: { icon: CircleCheck, text: 'amount = due', color: 'text-success' },
  awaiting: { icon: Timer, text: 'awaiting webhook', color: 'text-warning' },
  failed: { icon: CircleX, text: 'verification failed', color: 'text-danger' },
};
const STATUS: Record<ReconStatus, { label: string; bg: string; dot: string; text: string }> = {
  reconciled: { label: 'Reconciled', bg: 'bg-success-bg', dot: 'bg-success', text: 'text-success' },
  pending: { label: 'Pending', bg: 'bg-warning-bg', dot: 'bg-warning', text: 'text-warning' },
  failed: { label: 'Failed', bg: 'bg-danger-bg', dot: 'bg-danger', text: 'text-danger' },
};

export default async function ReconciliationPage() {
  const { stats: s, rows } = await getReconciliationView();

  const stats = [
    { value: s.reconciled30Short, label: 'Reconciled, 30 days', tone: 'text-foreground' },
    { value: s.matchedCount.toLocaleString(), label: 'Settlements matched', tone: 'text-foreground' },
    { value: s.awaitingCount.toLocaleString(), label: 'Awaiting match', tone: s.awaitingCount > 0 ? 'text-warning' : 'text-foreground' },
    { value: s.mismatchCount.toLocaleString(), label: 'Mismatches', tone: s.mismatchCount > 0 ? 'text-danger' : 'text-success' },
  ];

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
        {stats.map((st, i) => (
          <div key={st.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className={`text-[20px] font-semibold tracking-[-0.3px] ${st.tone}`}>{st.value}</span>
              <span className="text-[12.5px] text-muted-foreground">{st.label}</span>
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
      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          iconTone="accent"
          title="Nothing to reconcile yet"
          titleSize={16}
          description={'As payments settle, each one is re-queried against Nomba\nand its proof-of-match lands here — verified to the kobo.'}
        />
      ) : (
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
            const st = STATUS[r.status];
            const VerIcon = v.icon;
            return (
              <div
                key={r.reference}
                className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{r.customer}</span>
                <span className="w-[210px] truncate font-mono text-[11.5px] text-subtle-foreground">{r.ref}</span>
                <div className={`flex w-[210px] items-center gap-[7px] ${v.color}`}>
                  <VerIcon className="size-[15px] shrink-0" strokeWidth={1.75} />
                  <span className="text-[12.5px]">{v.text}</span>
                </div>
                <span className="w-[110px] text-right font-mono text-[13px] text-foreground">{r.amount}</span>
                <div className="w-[120px]">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${st.bg}`}>
                    <span className={`size-1.5 rounded-full ${st.dot}`} />
                    <span className={`text-[12px] font-medium ${st.text}`}>{st.label}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gap note */}
      <p className="text-[11.5px] text-subtle-foreground">
        Cross-tenant drift and ledger-integrity checks are operator tools in Admin. This view shows your own settled
        truth, verified against Nomba.
      </p>
    </div>
  );
}
