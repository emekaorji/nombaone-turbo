export const dynamic = 'force-dynamic';

import { CreditCard, Landmark, ArrowLeftRight, Check, Wallet, type LucideIcon } from 'lucide-react';

import { EmptyState } from '@/components/console/empty-state';
import { RailBadge } from '@/components/console/rail-badge';
import { getPaymentsView, type MethodStatus } from '@/lib/payments';

type Tone = 'success' | 'warning' | 'info' | 'danger';

const RAIL_ICON: Record<'card' | 'mandate' | 'virtual_account', LucideIcon> = {
  card: CreditCard,
  mandate: Landmark,
  virtual_account: ArrowLeftRight,
};

const toneBg: Record<Tone, string> = { success: 'bg-success-bg', warning: 'bg-warning-bg', info: 'bg-info-bg', danger: 'bg-danger-bg' };
const toneText: Record<Tone, string> = { success: 'text-success', warning: 'text-warning', info: 'text-info', danger: 'text-danger' };

const MSTATUS: Record<MethodStatus, { label: string; tone: Tone; dot: string }> = {
  active: { label: 'Active', tone: 'success', dot: 'bg-success' },
  expired: { label: 'Expired', tone: 'danger', dot: 'bg-danger' },
  consent_pending: { label: 'Consent pending', tone: 'warning', dot: 'bg-warning' },
  setup_pending: { label: 'Setup pending', tone: 'warning', dot: 'bg-warning' },
  removed: { label: 'Removed', tone: 'info', dot: 'bg-subtle-foreground' },
};

export default async function PaymentsPage() {
  const { rails, methods, totalMethods } = await getPaymentsView();

  return (
    <div className="flex h-full flex-col gap-4 lg:gap-5 px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Payments and rails</h1>
        <p className="text-[14px] text-muted-foreground">
          One subscription, every rail. How money reaches you, and how well each rail performs.
        </p>
      </div>

      {/* Rails overview */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {rails.map((r) => {
          const Icon = RAIL_ICON[r.kind];
          return (
            <div key={r.name} className="flex flex-1 flex-col gap-[13px] rounded-lg border border-border bg-surface-1 p-[18px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
                    <Icon className="size-[17px] text-foreground" strokeWidth={1.75} />
                  </div>
                  <span className="text-[14.5px] font-semibold text-foreground">{r.name}</span>
                </div>
                <span className={`rounded-full px-[9px] py-[3px] text-[11px] font-medium ${toneBg[r.chip.tone]} ${toneText[r.chip.tone]}`}>
                  {r.chip.text}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">
                  {r.activeCount.toLocaleString()}
                </span>
                <span className="text-[12px] text-subtle-foreground">active method{r.activeCount === 1 ? '' : 's'}</span>
              </div>
              <span className="text-[12.5px] text-muted-foreground">{r.detail}</span>
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-[11.5px] text-subtle-foreground">Recovery rate</span>
                <span className="font-mono text-[11.5px] text-subtle-foreground">— appears once billed</span>
              </div>
              <span className="text-[11.5px] text-subtle-foreground">{r.note}</span>
            </div>
          );
        })}
      </div>

      {/* Methods */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-foreground">Payment methods</span>
          <span className="text-[12.5px] text-subtle-foreground">
            {totalMethods.toLocaleString()} method{totalMethods === 1 ? '' : 's'}
          </span>
        </div>

        {totalMethods === 0 ? (
          <EmptyState
            icon={Wallet}
            iconTone="accent"
            title="No payment methods yet"
            titleSize={16}
            description={'Cards, mandates, and virtual accounts appear here as\ncustomers attach them during checkout.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
            <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
              <span className="flex-1">CUSTOMER</span>
              <span className="w-[230px]">METHOD</span>
              <span className="w-[150px]">RAIL</span>
              <span className="w-[150px]">STATUS</span>
              <span className="w-[80px]">DEFAULT</span>
              <span className="w-[90px]">ADDED</span>
            </div>

            {methods.map((m, i) => {
              const s = MSTATUS[m.status];
              const Icon = RAIL_ICON[m.kind];
              return (
                <div
                  key={m.reference}
                  className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < methods.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="flex-1 truncate text-[13px] font-medium text-foreground">{m.customer}</span>
                  <div className="flex w-[230px] items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[13px] text-foreground">{m.method}</span>
                      <span className="truncate text-[11px] text-subtle-foreground">{m.sub}</span>
                    </div>
                  </div>
                  <div className="w-[150px]">
                    <RailBadge rail={m.rail} />
                  </div>
                  <div className="w-[150px]">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${toneBg[s.tone]}`}>
                      <span className={`size-1.5 rounded-full ${s.dot}`} />
                      <span className={`text-[12px] font-medium ${toneText[s.tone]}`}>{s.label}</span>
                    </span>
                  </div>
                  <div className="w-[80px]">
                    {m.def ? <Check className="size-[15px] text-accent" strokeWidth={2.5} /> : <span className="text-[13px] text-subtle-foreground">—</span>}
                  </div>
                  <span className="w-[90px] text-[12.5px] text-muted-foreground">{m.added}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
