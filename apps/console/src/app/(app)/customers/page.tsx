export const dynamic = 'force-dynamic';

import { ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/console/empty-state';
import { ListSortMenu } from '@/components/console/list-sort-menu';
import { NewCustomerButton } from '@/components/console/customers/new-customer-button';
import { listCustomers, CUSTOMER_SORTS, type CustomerHealth, type CustomerSortKey } from '@/lib/customers';
import { nairaShort } from '@/lib/money';

const HEALTH: Record<CustomerHealth, { label: string; text: string; dot: string }> = {
  healthy: { label: 'Healthy', text: 'text-success', dot: 'bg-success' },
  at_risk: { label: 'At risk', text: 'text-warning', dot: 'bg-warning' },
  delinquent: { label: 'Delinquent', text: 'text-danger', dot: 'bg-danger' },
  trialing: { label: 'Trialing', text: 'text-info', dot: 'bg-info' },
  new: { label: 'New', text: 'text-subtle-foreground', dot: 'bg-subtle-foreground' },
};

const SEGMENTS = ['all', 'active', 'credit', 'new'] as const;
type Segment = (typeof SEGMENTS)[number];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ segment?: string; sort?: string }> }) {
  const sp = await searchParams;
  const segment: Segment = (SEGMENTS as readonly string[]).includes(sp.segment ?? '') ? (sp.segment as Segment) : 'all';
  const sort: CustomerSortKey = CUSTOMER_SORTS.some((s) => s.key === sp.sort) ? (sp.sort as CustomerSortKey) : 'mrr';

  const { items: allItems, stats } = await listCustomers(sort);
  const items = allItems.filter((c) =>
    segment === 'active' ? c.active > 0 : segment === 'credit' ? c.credit !== null : segment === 'new' ? c.health === 'new' : true,
  );
  const statCards = [
    { value: String(stats.total), label: 'Total customers' },
    { value: String(stats.newThisMonth), label: 'New this month' },
    { value: String(stats.withActiveSubs), label: 'With active subs' },
    { value: nairaShort(stats.creditOutstandingKobo), label: 'Credit outstanding' },
  ];
  const tabs: { key: Segment; label: string }[] = [
    { key: 'all', label: `All · ${stats.total}` },
    { key: 'active', label: 'With active subs' },
    { key: 'credit', label: 'Has credit' },
    { key: 'new', label: 'New' },
  ];

  return (
    <div className="flex flex-col gap-5 px-4 py-4 lg:px-7 lg:py-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Customers</h1>
          <p className="text-[14px] text-muted-foreground">
            Everyone who pays you, what they are worth, and who needs attention.
          </p>
        </div>
        <NewCustomerButton />
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {statCards.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
            </div>
            {i < statCards.length - 1 ? <div className="h-[38px] w-px bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Segment bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'all' ? '/customers' : `/customers?segment=${t.key}`}
              scroll={false}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                t.key === segment ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <ListSortMenu
          triggerText={`Sorted by ${CUSTOMER_SORTS.find((s) => s.key === sort)?.label ?? 'MRR'}`}
          current={sort}
          options={CUSTOMER_SORTS}
          basePath="/customers"
          defaultKey="mrr"
        />
      </div>

      {/* Table / empty */}
      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          iconTone="accent"
          title="No customers yet"
          titleSize={16}
          description={'Add your first customer to start billing them\nover card, direct debit, or transfer.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[880px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">CUSTOMER</span>
            <span className="w-[150px]">SUBSCRIPTIONS</span>
            <span className="w-[100px] text-right">MRR</span>
            <span className="w-[110px] text-right">CREDIT</span>
            <span className="w-[104px]">HEALTH</span>
            <span className="w-[96px]">JOINED</span>
          </div>

          {items.map((r, i) => {
            const h = HEALTH[r.health];
            return (
              <Link
                key={r.reference}
                href={`/customers/${encodeURIComponent(r.reference)}`}
                className={`flex min-w-[880px] items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
                  i < items.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                {/* Customer */}
                <div className="flex min-w-0 flex-1 items-center gap-[11px]">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-muted-foreground">
                    {r.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-medium text-foreground">{r.name}</span>
                    <span className="truncate text-[11.5px] text-subtle-foreground">{r.email}</span>
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="flex w-[150px] flex-col gap-0.5">
                  <span className="text-[13px] text-foreground">{r.active} active</span>
                  <span className="text-[11px] text-subtle-foreground">{r.total} total</span>
                </div>

                {/* MRR */}
                <div className="w-[100px] text-right">
                  <span className={`font-mono text-[13px] ${r.mrr ? 'text-foreground' : 'text-subtle-foreground'}`}>
                    {r.mrr ?? '—'}
                  </span>
                </div>

                {/* Credit */}
                <div className="w-[110px] text-right">
                  <span className={`font-mono text-[13px] ${r.credit ? 'text-accent' : 'text-subtle-foreground'}`}>
                    {r.credit ?? '—'}
                  </span>
                </div>

                {/* Health */}
                <div className="flex w-[104px] items-center gap-[7px]">
                  <span className={`size-2 shrink-0 rounded-full ${h.dot}`} />
                  <span className={`text-[12.5px] ${h.text}`}>{h.label}</span>
                </div>

                {/* Joined */}
                <div className="flex w-[96px] items-center justify-between">
                  <span className="text-[12.5px] text-muted-foreground">{r.joined}</span>
                  <ChevronRight className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
