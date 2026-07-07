export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Download, FileText } from 'lucide-react';

import { EmptyState } from '@/components/console/empty-state';
import { ListSortMenu } from '@/components/console/list-sort-menu';
import { getInvoicesView, INVOICE_SORTS, nairaShort, type InvoiceSortKey, type InvoiceStatus, type InvoiceRow } from '@/lib/invoices';

const STATUS: Record<InvoiceStatus, { label: string; text: string; bg: string; dot: string }> = {
  paid: { label: 'Paid', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  open: { label: 'Open', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  partially_paid: { label: 'Partially paid', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  uncollectible: { label: 'Uncollectible', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
  void: { label: 'Void', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
};

const SEGMENTS = ['all', 'open', 'past_due', 'partially_paid', 'paid', 'uncollectible'] as const;
type Segment = (typeof SEGMENTS)[number];
function inSegment(r: InvoiceRow, seg: Segment): boolean {
  switch (seg) {
    case 'open':
      return r.status === 'open';
    case 'past_due':
      return r.overdue;
    case 'partially_paid':
      return r.status === 'partially_paid';
    case 'paid':
      return r.status === 'paid';
    case 'uncollectible':
      return r.status === 'uncollectible';
    case 'all':
    default:
      return true;
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const segment: Segment = (SEGMENTS as readonly string[]).includes(sp.segment ?? '')
    ? (sp.segment as Segment)
    : 'all';
  const sort: InvoiceSortKey = INVOICE_SORTS.some((s) => s.key === sp.sort) ? (sp.sort as InvoiceSortKey) : 'newest';

  const view = await getInvoicesView(sort);
  const rows = view.rows.filter((r) => inSegment(r, segment));
  const empty = view.tabs[0].count === 0;

  const stats = [
    { value: nairaShort(view.stats.collectedKobo), label: 'Collected, 30 days', tone: 'foreground' as const },
    { value: nairaShort(view.stats.outstandingKobo), label: 'Outstanding', tone: 'foreground' as const },
    { value: nairaShort(view.stats.overdueKobo), label: 'Overdue', tone: 'warning' as const },
    { value: nairaShort(view.stats.uncollectibleKobo), label: 'Uncollectible', tone: 'danger' as const },
  ];
  const tabs = view.tabs.map((t) => ({
    key: t.key,
    label: t.key === 'all' || t.key === 'paid' ? t.label : `${t.label} · ${t.count.toLocaleString()}`,
    active: t.key === segment,
  }));

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
        <button
          disabled={empty}
          title={empty ? 'Nothing to export yet' : 'Export invoices'}
          className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50"
        >
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
            <Link
              key={t.key}
              href={t.key === 'all' ? '/invoices' : `/invoices?segment=${t.key}`}
              scroll={false}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                t.active ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <ListSortMenu
          triggerText={INVOICE_SORTS.find((s) => s.key === sort)?.label ?? 'Newest first'}
          current={sort}
          options={INVOICE_SORTS}
          basePath="/invoices"
          defaultKey="newest"
        />
      </div>

      {/* Table / empty */}
      {empty ? (
        <EmptyState
          icon={FileText}
          iconTone="accent"
          title="No invoices yet"
          titleSize={16}
          description={'Invoices are issued by the billing engine each cycle.\nThey appear here the moment a subscription bills.'}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices match this segment"
          titleSize={15}
          description={'Nothing here right now.\nTry another segment.'}
          action={
            <Link
              href="/invoices"
              className="flex items-center gap-[7px] rounded border border-border-strong bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3"
            >
              Clear filter
            </Link>
          }
        />
      ) : (
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
                key={r.reference}
                href={`/invoices/${r.reference}`}
                className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
                  i < rows.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                {/* Invoice */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-[13px] font-medium text-foreground">{r.reference}</span>
                  <span className="truncate text-[11px] text-subtle-foreground">{r.meta}</span>
                </div>

                {/* Customer */}
                <div className="w-[150px]">
                  <span className="truncate text-[13px] text-muted-foreground">{r.customer}</span>
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
      )}
    </div>
  );
}
