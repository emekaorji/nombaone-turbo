import { Plus, Info, Archive } from 'lucide-react';

type PlanStatus = 'active' | 'archived';
const plans = [
  { name: 'Pro', subs: 412, prices: 3, mrr: '₦4.1M', status: 'active' as PlanStatus, sel: true },
  { name: 'Starter', subs: 180, prices: 2, mrr: '₦2.5M', status: 'active' as PlanStatus, sel: false },
  { name: 'Team', subs: 96, prices: 2, mrr: '₦1.8M', status: 'active' as PlanStatus, sel: false },
  { name: 'Enterprise', subs: 12, prices: 1, mrr: '₦1.2M', status: 'active' as PlanStatus, sel: false },
  { name: 'Legacy', subs: 40, prices: 1, mrr: '₦0.3M', status: 'archived' as PlanStatus, sel: false },
];

const stats = [
  { value: '412', label: 'Subscribers' },
  { value: '₦4.1M', label: 'MRR' },
  { value: '3', label: 'Prices' },
  { value: 'licensed', label: 'Billing' },
];

const prices = [
  { amount: '₦18,000', interval: 'monthly', type: 'licensed · per_unit', subs: '412', status: 'active' as PlanStatus },
  { amount: '₦180,000', interval: 'annual', type: 'licensed · per_unit', subs: '88', status: 'active' as PlanStatus },
  { amount: '₦15,000', interval: 'monthly', type: 'licensed · per_unit', subs: '24', status: 'archived' as PlanStatus },
];

function StatusPill({ status }: { status: PlanStatus }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${active ? 'bg-success-bg' : 'bg-surface-2'}`}>
      <span className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-subtle-foreground'}`} />
      <span className={`text-[12px] font-medium ${active ? 'text-success' : 'text-muted-foreground'}`}>
        {active ? 'Active' : 'Archived'}
      </span>
    </span>
  );
}

export default function PlansPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Plans and prices</h1>
          <p className="text-[14px] text-muted-foreground">
            Your catalog. Prices are versioned and immutable, so a change is a new price.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          New plan
        </button>
      </div>

      {/* Master-detail */}
      <div className="flex flex-col lg:flex-row min-h-0 flex-1 gap-[18px]">
        {/* Plans list */}
        <div className="flex w-full lg:w-[336px] lg:shrink-0 flex-col gap-2.5">
          {plans.map((p) => (
            <button
              key={p.name}
              className={`flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-colors ${
                p.sel ? 'border-accent bg-surface-2' : 'border-border bg-surface-1 hover:border-border-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-foreground">{p.name}</span>
                <StatusPill status={p.status} />
              </div>
              <span className="text-[12.5px] text-subtle-foreground">
                {p.subs} subscribers · {p.prices} prices
              </span>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-[17px] font-semibold tracking-[-0.3px] text-foreground">{p.mrr}</span>
                <span className="text-[11.5px] text-subtle-foreground">MRR</span>
              </div>
            </button>
          ))}
        </div>

        {/* Plan detail */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Detail head */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-[18px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[20px] font-semibold text-foreground">Pro</span>
                <StatusPill status="active" />
              </div>
              <div className="flex items-center gap-2.5">
                <button className="flex items-center gap-1.5 rounded border border-border px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
                  <Archive className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
                  Archive
                </button>
                <button className="flex items-center gap-1.5 rounded bg-accent px-3 py-[7px] text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                  <Plus className="size-4" strokeWidth={2} />
                  New price
                </button>
              </div>
            </div>
            <div className="flex items-center">
              {stats.map((s, i) => (
                <div key={s.label} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[19px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
                    <span className="text-[12px] text-muted-foreground">{s.label}</span>
                  </div>
                  {i < stats.length - 1 ? <div className="h-9 w-px bg-border" /> : null}
                </div>
              ))}
            </div>
          </div>

          {/* Prices card */}
          <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden rounded-lg border border-border bg-surface-1 p-[18px]">
            <span className="text-[15px] font-semibold text-foreground">Prices</span>

            {/* Immutable callout */}
            <div className="flex items-start gap-2.5 rounded border border-accent-border bg-accent-muted px-3.5 py-3">
              <Info className="mt-px size-4 shrink-0 text-accent" strokeWidth={2} />
              <p className="text-[12.5px] text-foreground">
                Prices are immutable. To change pricing, add a new price and deactivate the old one. Existing
                subscribers keep the price they signed up on.
              </p>
            </div>

            {/* Price ladder */}
            <div className="flex flex-col">
              <div className="flex items-center gap-[14px] border-b border-border px-1 py-2.5 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
                <span className="flex-1">AMOUNT</span>
                <span className="w-[120px]">INTERVAL</span>
                <span className="w-[150px]">TYPE</span>
                <span className="w-[96px] text-right">SUBSCRIBERS</span>
                <span className="w-[104px]">STATUS</span>
                <span className="w-[110px]" />
              </div>
              {prices.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-[14px] px-1 py-3 ${i < prices.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="flex-1 font-mono text-[13.5px] font-medium text-foreground">{p.amount}</span>
                  <span className="w-[120px] text-[12.5px] text-muted-foreground">{p.interval}</span>
                  <span className="w-[150px] font-mono text-[11.5px] text-subtle-foreground">{p.type}</span>
                  <span className="w-[96px] text-right font-mono text-[13px] text-foreground">{p.subs}</span>
                  <span className="w-[104px]">
                    <StatusPill status={p.status} />
                  </span>
                  <span className="w-[110px]">
                    {p.status === 'active' ? (
                      <button className="text-[12.5px] text-danger hover:underline">Deactivate</button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
