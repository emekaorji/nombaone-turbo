export const dynamic = 'force-dynamic';

import { AlertTriangle, Info, Layers } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/console/empty-state';
import { NewPlanButton } from '@/components/console/plans/new-plan-button';
import { NewPriceButton } from '@/components/console/plans/new-price-button';
import {
  ArchivePlanButton,
  ChangePriceButton,
  DeactivatePriceButton,
  EditPlanButton,
} from '@/components/console/plans/plan-action-buttons';
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
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Plans</h1>
          <p className="text-[14px] text-muted-foreground">
            Your catalog. Change a price any time — existing subscribers keep the price they signed up on.
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
          description={'Create your first plan and set what it costs.'}
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
                {/* The ladder, in one line — what a customer can actually be put on. */}
                {p.billable ? (
                  <span className="truncate text-[12.5px] text-muted-foreground">{p.ladder}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12.5px] text-warning">
                    <AlertTriangle className="size-[13px] shrink-0" strokeWidth={2} />
                    Can&apos;t be billed — no price
                  </span>
                )}
                <span className="text-[12.5px] text-subtle-foreground">
                  {p.subscribers} {p.subscribers === 1 ? 'subscriber' : 'subscribers'}
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
                  {detail.status === 'active' ? (
                    <EditPlanButton planRef={detail.reference} name={detail.name} description={detail.description} />
                  ) : null}
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

            {/* The price ladder */}
            <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[15px] font-semibold text-foreground">What it costs</span>
                {detail.billable ? (
                  <span className="truncate font-mono text-[12.5px] text-muted-foreground">{detail.ladder}</span>
                ) : null}
              </div>

              {/* A legacy plan with nothing to bill against. The create form can no longer produce one,
                  but the rows it already produced are still here — so this is a repair, not a step. */}
              {!detail.billable ? (
                <div className="flex items-start gap-2.5 rounded border border-warning/40 bg-warning-bg px-3.5 py-3">
                  <AlertTriangle className="mt-px size-4 shrink-0 text-warning" strokeWidth={2} />
                  <div className="flex flex-1 flex-col items-start gap-2.5">
                    <p className="text-[12.5px] text-foreground">
                      This plan can&apos;t be billed yet — add a price. Nobody can subscribe to it until you do.
                    </p>
                    <NewPriceButton planRef={detail.reference} label="Add a price" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded border border-accent-border bg-accent-muted px-3.5 py-3">
                  <Info className="mt-px size-4 shrink-0 text-accent" strokeWidth={2} />
                  <p className="text-[12.5px] text-foreground">
                    Change a price whenever you like. The old price is retired, not rewritten — existing subscribers
                    keep what they signed up on, and only new subscribers pay the new one.
                  </p>
                </div>
              )}

              {detail.prices.length === 0 ? null : (
                <div className="flex flex-col">
                  {detail.prices.map((p, i) => (
                    <div
                      key={p.reference}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-3.5 ${i < detail.prices.length - 1 ? 'border-b border-border' : ''} ${p.active ? '' : 'opacity-60'}`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[14px] font-medium text-foreground">{p.short}</span>
                          {p.savings > 0 ? (
                            <span className="rounded-full bg-success-bg px-2 py-[2px] text-[11px] font-medium text-success">
                              save {p.savings}%
                            </span>
                          ) : null}
                          {p.active ? null : (
                            <span className="rounded-full bg-surface-2 px-2 py-[2px] text-[11px] font-medium text-muted-foreground">
                              Retired
                            </span>
                          )}
                        </div>
                        <span className="text-[12px] text-subtle-foreground">
                          Bills {p.cadence} · {p.type} · {p.subscribers}{' '}
                          {p.subscribers === 1 ? 'subscriber' : 'subscribers'}
                        </span>
                      </div>
                      {p.active ? (
                        <div className="flex items-center gap-4">
                          <ChangePriceButton priceRef={p.reference} current={p.short} subscribers={p.subscribers} />
                          <DeactivatePriceButton priceRef={p.reference} />
                        </div>
                      ) : null}
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
