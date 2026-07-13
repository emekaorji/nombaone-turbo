export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Banknote, Landmark } from 'lucide-react';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { EmptyState } from '@/components/console/empty-state';
import { RefundButton, WithdrawButton } from '@/components/console/settlements/settlement-buttons';
import { getSession } from '@/lib/auth';
import { getBanks, getSettlementsView, type SettlementStatus, type PayoutStatus } from '@/lib/settlements';

const STATUS: Record<SettlementStatus, { label: string; text: string; bg: string; dot: string }> = {
  settled: { label: 'Settled', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  reconciled: { label: 'Reconciled', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  pending: { label: 'Pending', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  refunded: { label: 'Refunded', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
  failed: { label: 'Failed', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
};

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; text: string; bg: string; dot: string }> = {
  pending: { label: 'Pending', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  ledger_posted: { label: 'Processing', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  succeeded: { label: 'Paid', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  failed: { label: 'Failed', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
};

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: 'settlements' | 'payouts' = sp.tab === 'payouts' ? 'payouts' : 'settlements';
  const [{ escrow, settlements, payouts, payoutAccount }, session, banks] = await Promise.all([
    getSettlementsView(),
    getSession(),
    getBanks(),
  ]);
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;

  const escrowRows = [
    { label: 'Balance', value: escrow.balance, tone: 'default' as const },
    { label: 'Locked in escrow (3h buffer)', value: escrow.locked, tone: 'warning' as const },
  ];

  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Settlements and payouts</h1>

      {/* Escrow hero */}
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface-1 px-6 py-[22px] lg:flex-row lg:items-center lg:gap-7">
        <div className="flex w-full shrink-0 flex-col gap-[14px] lg:w-[280px]">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.4px] text-subtle-foreground">AVAILABLE TO WITHDRAW</span>
            <span className="text-[38px] font-semibold leading-none tracking-[-1px] text-accent">{escrow.availableShort}</span>
          </div>
          <WithdrawButton
            availableShort={escrow.availableShort}
            canManage={canManage}
            banks={banks}
            payoutAccount={payoutAccount}
          />
        </div>

        <div className="hidden h-[120px] w-px shrink-0 bg-border lg:block" />

        <div className="flex flex-1 flex-col gap-2.5">
          {escrowRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">{r.label}</span>
              <span className={`font-mono text-[13.5px] ${r.tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>{r.value}</span>
            </div>
          ))}
          <div className="h-px w-full bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Available</span>
            <span className="font-mono text-[13.5px] font-semibold text-accent">{escrow.available}</span>
          </div>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-3">
            {escrow.bar.map((s, i) => (
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
        <Link
          href="/settlements"
          scroll={false}
          className={`rounded px-3.5 py-1.5 text-[13px] font-medium transition-colors ${tab === 'settlements' ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Settlements
        </Link>
        <Link
          href="/settlements?tab=payouts"
          scroll={false}
          className={`rounded px-3.5 py-1.5 text-[13px] font-medium transition-colors ${tab === 'payouts' ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Payouts
        </Link>
      </div>

      {/* Settlements table */}
      {tab === 'settlements' ? (
        settlements.length === 0 ? (
          <EmptyState
            icon={Landmark}
            iconTone="accent"
            title="No settlements yet"
            titleSize={16}
            description={'Every collected payment is split at the source — your share\nto your sub-account, the platform fee to Nomba — and lands here.'}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
            <div className="flex min-w-[980px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
              <span className="flex-1">INVOICE / CUSTOMER</span>
              <span className="w-[120px] text-right">GROSS</span>
              <span className="w-[100px] text-right">FEE</span>
              <span className="w-[130px] text-right">NET TO YOU</span>
              <span className="w-[130px]">STATUS</span>
              <span className="w-[90px]">SETTLED</span>
              <span className="w-[80px]" />
            </div>
            {settlements.map((r, i) => {
              const s = STATUS[r.status];
              const refundable = r.status === 'settled' || r.status === 'reconciled';
              return (
                <div
                  key={r.reference}
                  className={`flex min-w-[980px] items-center gap-[14px] px-4 py-3 ${i < settlements.length - 1 ? 'border-b border-border' : ''}`}
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
                  <div className="flex w-[80px] justify-end">
                    {refundable ? <RefundButton settlementReference={r.reference} canManage={canManage} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={Banknote}
          iconTone="accent"
          title="No payouts yet"
          titleSize={16}
          description={'Withdrawals to your bank appear here once your settled\nbalance clears the 3-hour refund buffer.'}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[760px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">DESTINATION</span>
            <span className="w-[120px]">BANK</span>
            <span className="w-[130px] text-right">AMOUNT</span>
            <span className="w-[130px]">STATUS</span>
            <span className="w-[90px]">CREATED</span>
          </div>
          {payouts.map((r, i) => {
            const s = PAYOUT_STATUS[r.status];
            return (
              <div
                key={r.reference}
                className={`flex min-w-[760px] items-center gap-[14px] px-4 py-3 ${i < payouts.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-foreground">{r.destination}</span>
                  <span className="truncate font-mono text-[11px] text-subtle-foreground">{r.reference}</span>
                </div>
                <span className="w-[120px] font-mono text-[12.5px] text-muted-foreground">{r.bank}</span>
                <span className="w-[130px] text-right font-mono text-[13px] font-medium text-foreground">{r.amount}</span>
                <div className="w-[130px]">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                    <span className={`size-1.5 rounded-full ${s.dot}`} />
                    <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                  </span>
                </div>
                <span className="w-[90px] text-[12.5px] text-muted-foreground">{r.created}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
