export const dynamic = 'force-dynamic';

import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { InvoiceActions } from '@/components/console/invoices/invoice-actions';
import { InvoicePrintButton } from '@/components/console/invoices/invoice-print-button';
import { getSession } from '@/lib/auth';
import { getInvoiceDetail } from '@/lib/invoice-detail';
import { nairaShort } from '@/lib/money';

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string }> = {
  paid: { bg: 'bg-success-bg', dot: 'bg-success', text: 'text-success' },
  open: { bg: 'bg-info-bg', dot: 'bg-info', text: 'text-info' },
  partially_paid: { bg: 'bg-warning-bg', dot: 'bg-warning', text: 'text-warning' },
  uncollectible: { bg: 'bg-danger-bg', dot: 'bg-danger', text: 'text-danger' },
  void: { bg: 'bg-surface-2', dot: 'bg-subtle-foreground', text: 'text-muted-foreground' },
};
const toneText: Record<string, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' };

function Fields({ rows }: { rows: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((f, i) => (
        <div key={f.label} className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}>
          <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
          <span className={`text-[12.5px] font-medium ${f.tone ? toneText[f.tone] : 'text-foreground'}`}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, session] = await Promise.all([getInvoiceDetail(decodeURIComponent(id)), getSession()]);
  if (!inv) notFound();
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;

  const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.open;
  const splitBar = inv.split
    ? [
        { grow: Math.max(inv.split.feeKobo, 1), c: 'bg-accent' },
        { grow: Math.max(inv.split.netKobo, 1), c: 'bg-success' },
      ]
    : [];

  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">{inv.amount}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${s.bg}`}>
              <span className={`size-1.5 rounded-full ${s.dot}`} />
              <span className={`text-[12px] font-medium ${s.text}`}>{inv.statusLabel}</span>
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">{inv.subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5 print:hidden">
          <InvoicePrintButton />
          <InvoiceActions invoiceReference={inv.reference} status={inv.status} canManage={canManage} />
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
              {inv.breakdown.map((r) => (
                <div key={r.label}>
                  {r.divTop ? <div className="mb-[9px] h-px w-full bg-border" /> : null}
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] ${r.bold ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{r.label}</span>
                    <span className={`font-mono text-[13.5px] ${r.bold ? 'font-medium' : ''} ${r.good ? 'text-success' : 'text-foreground'}`}>
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
              {inv.lineItems.map((l, i) => (
                <div key={i} className="flex items-center gap-[14px] py-2.5">
                  <span className="flex-1 text-[13px] text-foreground">{l.desc}</span>
                  <span className="w-[130px] text-[13px] text-muted-foreground">{l.qty}</span>
                  <span className="w-[110px] text-right font-mono text-[13px] text-foreground">{l.amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-[13px] font-semibold text-foreground">Total</span>
                <span className="font-mono text-[13.5px] font-semibold text-foreground">{inv.totalLabel}</span>
              </div>
            </div>
          </CardShell>

          {/* Ledger receipt — only when a transaction posted */}
          {inv.ledger ? (
            <CardShell className="flex flex-col gap-3 p-[18px]">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-foreground">Ledger receipt</span>
                {inv.ledger.balanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-[9px] py-[3px]">
                    <Check className="size-3 text-success" strokeWidth={2.5} />
                    <span className="text-[11.5px] font-medium text-success">Balanced</span>
                  </span>
                ) : (
                  <span className="rounded-full bg-warning-bg px-[9px] py-[3px] text-[11.5px] font-medium text-warning">Unbalanced</span>
                )}
              </div>
              <span className="font-mono text-[11.5px] text-subtle-foreground">{inv.ledger.txnReference}</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-[14px] pb-1.5 font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">
                  <span className="flex-1">ACCOUNT</span>
                  <span className="w-[110px] text-right">DEBIT</span>
                  <span className="w-[110px] text-right">CREDIT</span>
                </div>
                {inv.ledger.legs.map((l, i) => (
                  <div key={i} className="flex items-center gap-[14px] py-[7px]">
                    <span className="flex-1 text-[12.5px] capitalize text-foreground">{l.account}</span>
                    <span className={`w-[110px] text-right font-mono text-[12.5px] ${l.debit === '—' ? 'text-subtle-foreground' : 'text-foreground'}`}>{l.debit}</span>
                    <span className={`w-[110px] text-right font-mono text-[12.5px] ${l.credit === '—' ? 'text-subtle-foreground' : 'text-foreground'}`}>{l.credit}</span>
                  </div>
                ))}
              </div>
              {inv.split ? (
                <>
                  <div className="h-px w-full bg-border" />
                  <span className="font-mono text-[11.5px] text-subtle-foreground">settlement — gross splits into fee and net</span>
                  <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-3">
                    {splitBar.map((b, i) => (
                      <div key={i} className={b.c} style={{ flexGrow: b.grow }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-[18px]">
                    <div className="flex items-center gap-[7px]">
                      <span className="size-2 rounded-full bg-foreground" />
                      <span className="text-[12px] text-muted-foreground">gross {nairaShort(inv.split.grossKobo)}</span>
                    </div>
                    <div className="flex items-center gap-[7px]">
                      <span className="size-2 rounded-full bg-accent" />
                      <span className="text-[12px] text-muted-foreground">fee {nairaShort(inv.split.feeKobo)}</span>
                    </div>
                    <div className="flex items-center gap-[7px]">
                      <span className="size-2 rounded-full bg-success" />
                      <span className="text-[12px] text-muted-foreground">net {nairaShort(inv.split.netKobo)}</span>
                    </div>
                  </div>
                </>
              ) : null}
              <span className="text-[11px] text-subtle-foreground">Immutable. A correction posts a new reversing entry, never an edit.</span>
            </CardShell>
          ) : null}
        </div>

        {/* Right */}
        <div className="flex w-full lg:w-[344px] lg:shrink-0 flex-col gap-4">
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[14px] font-semibold text-foreground">Details</span>
            <Fields rows={inv.details} />
          </CardShell>

          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[14px] font-semibold text-foreground">Payment</span>
            <Fields rows={inv.payment} />
          </CardShell>
        </div>
      </div>
    </div>
  );
}
