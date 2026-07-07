export const dynamic = 'force-dynamic';

import { Info, Layers } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/console/empty-state';
import { NewPlanButton } from '@/components/console/plans/new-plan-button';
import { NewPriceButton } from '@/components/console/plans/new-price-button';
import { ArchivePlanButton, DeactivatePriceButton, EditPlanButton } from '@/components/console/plans/plan-action-buttons';
import { listPlans, type PlanStatus } from '@/lib/plans';

function StatusPill({ status }: { status: PlanStatus }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${active ? 'bg-success-bg' : 'bg-surface-2'}`}
    >
      <span className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-subtle-foreground'}`} />
      <span className={`text-[12px] font-medium ${active ? 'text-success' : 'text-muted-foreground'}`}>
        {active ? 'Active' : 'Archived'}
      </span>
    </span>
  );
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams;
  const { cards, detail } = await listPlans(sp.plan);

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Plans and prices</h1>
          <p className="text-[14px] text-muted-foreground">
            Your catalog. Prices are versioned and immutable, so a change is a new price.
          </p>
        </div>
        <NewPlanButton />
      </div>

      {cards.length === 0 || !detail ? (
        <EmptyState
          icon={Layers}
          iconTone="accent"
          title="No plans yet"
          titleSize={16}
          description={'Create your first plan, then add a price.\nSubscriptions bill against a price.'}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] lg:flex-row">
          {/* Plans list */}
          <div className="flex w-full flex-col gap-2.5 lg:w-[336px] lg:shrink-0">
            {cards.map((p) => (
              <Link
                key={p.reference}
                href={`/plans?plan=${encodeURIComponent(p.reference)}`}
                scroll={false}
                className={`flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-colors ${
                  p.selected ? 'border-accent bg-surface-2' : 'border-border bg-surface-1 hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-foreground">{p.name}</span>
                  <StatusPill status={p.status} />
                </div>
                <span className="text-[12.5px] text-subtle-foreground">
                  {p.subscribers} subscribers · {p.pricesCount} {p.pricesCount === 1 ? 'price' : 'prices'}
                </span>
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="text-[17px] font-semibold tracking-[-0.3px] text-foreground">{p.mrr}</span>
                  <span className="text-[11.5px] text-subtle-foreground">MRR</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Plan detail */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Detail head */}
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-[18px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[20px] font-semibold text-foreground">{detail.name}</span>
                  <StatusPill status={detail.status} />
                </div>
                <div className="flex items-center gap-2.5">
                  {detail.status === 'active' ? <EditPlanButton planRef={detail.reference} name={detail.name} description={detail.description} /> : null}
                  {detail.status === 'active' ? <ArchivePlanButton planRef={detail.reference} /> : null}
                  <NewPriceButton planRef={detail.reference} />
                </div>
              </div>
              <div className="flex items-center">
                {[
                  { value: String(detail.subscribers), label: 'Subscribers' },
                  { value: detail.mrr, label: 'MRR' },
                  { value: String(detail.pricesCount), label: 'Prices' },
                  { value: detail.billing, label: 'Billing' },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex flex-1 items-center">
                    <div className="flex flex-1 flex-col gap-[3px]">
                      <span className="text-[19px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
                      <span className="text-[12px] text-muted-foreground">{s.label}</span>
                    </div>
                    {i < arr.length - 1 ? <div className="h-9 w-px bg-border" /> : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Prices card */}
            <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
              <span className="text-[15px] font-semibold text-foreground">Prices</span>

              <div className="flex items-start gap-2.5 rounded border border-accent-border bg-accent-muted px-3.5 py-3">
                <Info className="mt-px size-4 shrink-0 text-accent" strokeWidth={2} />
                <p className="text-[12.5px] text-foreground">
                  Prices are immutable. To change pricing, add a new price and deactivate the old one. Existing
                  subscribers keep the price they signed up on.
                </p>
              </div>

              {detail.prices.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-8 text-center">
                  <span className="text-[13.5px] font-medium text-foreground">No prices yet</span>
                  <span className="text-[12.5px] text-muted-foreground">Add a price so this plan can be billed.</span>
                </div>
              ) : (
                <div className="flex flex-col overflow-x-auto">
                  <div className="flex min-w-[600px] items-center gap-[14px] border-b border-border px-1 py-2.5 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
                    <span className="flex-1">AMOUNT</span>
                    <span className="w-[120px]">INTERVAL</span>
                    <span className="w-[150px]">TYPE</span>
                    <span className="w-[96px] text-right">SUBSCRIBERS</span>
                    <span className="w-[104px]">STATUS</span>
                    <span className="w-[110px]" />
                  </div>
                  {detail.prices.map((p, i) => (
                    <div
                      key={p.reference}
                      className={`flex min-w-[600px] items-center gap-[14px] px-1 py-3 ${i < detail.prices.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <span className="flex-1 font-mono text-[13.5px] font-medium text-foreground">{p.amount}</span>
                      <span className="w-[120px] text-[12.5px] text-muted-foreground">{p.interval}</span>
                      <span className="w-[150px] font-mono text-[11.5px] text-subtle-foreground">{p.type}</span>
                      <span className="w-[96px] text-right font-mono text-[13px] text-foreground">{p.subscribers}</span>
                      <span className="w-[104px]">
                        <StatusPill status={p.active ? 'active' : 'archived'} />
                      </span>
                      <span className="w-[110px]">
                        {p.active ? <DeactivatePriceButton priceRef={p.reference} /> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
