import { Plus, ChevronDown, ChevronRight, CreditCard, Landmark } from 'lucide-react';

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

const subs = [
  { name: 'Scale', plan: 'monthly · ₦120,000', status: 'active' as const, mrr: '₦120,000', renews: 'renews 3 Oct' },
  { name: 'Analytics add-on', plan: 'monthly · ₦15,000', status: 'active' as const, mrr: '₦15,000', renews: 'renews 3 Oct' },
  { name: 'Legacy Basic', plan: 'monthly · ₦8,000', status: 'canceled' as const, mrr: '—', renews: 'ended 1 Aug' },
];

type Tone = 'success' | 'neutral' | 'info' | 'accent';
const activity: { type: string; meta: string; time: string; tone: Tone }[] = [
  { type: 'credit.granted', meta: 'Refund credit · ₦1,600', time: '12 Sep', tone: 'accent' },
  { type: 'invoice.payment_succeeded', meta: '₦135,000 · direct debit', time: '3 Sep', tone: 'success' },
  { type: 'subscription.created', meta: 'Analytics add-on', time: '20 Aug', tone: 'neutral' },
  { type: 'payment_method.attached', meta: 'Card ·4242', time: '2 Aug', tone: 'info' },
  { type: 'customer.updated', meta: 'billing email changed', time: '19 Nov', tone: 'neutral' },
];

const details = [
  { label: 'Status', value: 'Healthy', tone: 'success' as const },
  { label: 'Customer since', value: '19 Nov 2025' },
  { label: 'Lifetime value', value: '₦2.41M' },
  { label: 'Invoices', value: '24 paid' },
  { label: 'Currency', value: 'NGN' },
];

const grants = [
  { source: 'Refund · inv nbo55b', date: '12 Sep', left: '₦1,600 left' },
  { source: 'Goodwill credit', date: '1 Aug', left: '₦800 left' },
];

const methods = [
  { icon: CreditCard, label: 'Visa ·4242', sub: 'exp 09/28', def: true },
  { icon: Landmark, label: 'Direct debit mandate', sub: 'GTBank · active', def: false },
];

const dotC: Record<Tone, string> = { success: 'bg-success', neutral: 'bg-subtle-foreground', info: 'bg-info', accent: 'bg-accent' };
const typeC: Record<Tone, string> = { success: 'text-success', neutral: 'text-foreground', info: 'text-info', accent: 'text-accent' };

export default function CustomerDetailPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-3 text-[15px] font-medium text-muted-foreground">
            KR
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.3px] text-foreground">Kola Retail</h1>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span>ops@kola.ng</span>
              <span className="text-subtle-foreground">·</span>
              <span>+234 801 234 5678</span>
              <span className="text-subtle-foreground">·</span>
              <span className="font-mono text-[12px] text-subtle-foreground">nbo662019930014cus</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
            <Plus className="size-4" strokeWidth={2} />
            New subscription
          </button>
          <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
            Actions
            <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-col lg:flex-row min-h-0 flex-1 gap-[18px]">
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Subscriptions */}
          <CardShell className="flex flex-col p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[14px] font-semibold text-foreground">Subscriptions</span>
              <span className="text-[12px] text-subtle-foreground">3 total</span>
            </div>
            {subs.map((s, i) => (
              <div
                key={s.name}
                className={`flex items-center gap-3.5 px-0.5 py-[11px] ${i < subs.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium text-foreground">{s.name}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{s.plan}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.status === 'active' ? 'bg-accent-muted' : 'bg-surface-2'}`}
                >
                  <span className={`size-1.5 rounded-full ${s.status === 'active' ? 'bg-accent' : 'bg-subtle-foreground'}`} />
                  <span className={`text-[12px] font-medium ${s.status === 'active' ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
                    {s.status === 'active' ? 'Active' : 'Canceled'}
                  </span>
                </span>
                <span className="w-[86px] text-right font-mono text-[13px] text-foreground">{s.mrr}</span>
                <span className="w-[92px] text-[12px] text-muted-foreground">{s.renews}</span>
                <ChevronRight className="size-[15px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
              </div>
            ))}
          </CardShell>

          {/* Activity */}
          <CardShell className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <span className="pb-1 text-[14px] font-semibold text-foreground">Activity</span>
            {activity.map((n, i) => (
              <div key={i} className="flex gap-3 py-[9px]">
                <div className="flex w-3.5 flex-col items-center">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${dotC[n.tone]}`} />
                  {i < activity.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pb-1">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={`truncate font-mono text-[12.5px] ${typeC[n.tone]}`}>{n.type}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{n.meta}</span>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-subtle-foreground">{n.time}</span>
                </div>
              </div>
            ))}
          </CardShell>
        </div>

        {/* Right */}
        <div className="flex w-full lg:w-[344px] lg:shrink-0 flex-col gap-4">
          {/* Details */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Details</span>
            <div className="flex flex-col">
              {details.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between py-2 ${i < details.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
                  <span className={`text-[12.5px] font-medium ${f.tone === 'success' ? 'text-success' : 'text-foreground'}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Account credit */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Account credit</span>
              <button className="text-[12px] text-accent hover:underline">Add credit</button>
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-[26px] font-semibold tracking-[-0.4px] text-accent">₦2,400</span>
              <span className="text-[12.5px] text-muted-foreground">available</span>
            </div>
            <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">GRANTS · OLDEST FIRST</span>
            <div className="flex flex-col">
              {grants.map((g, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-2 ${i < grants.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12.5px] text-foreground">{g.source}</span>
                    <span className="text-[11px] text-subtle-foreground">{g.date}</span>
                  </div>
                  <span className="font-mono text-[12.5px] text-foreground">{g.left}</span>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-subtle-foreground">Applied oldest first to future invoices.</span>
          </CardShell>

          {/* Discount */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Discount</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-accent-muted px-[9px] py-[3px] font-mono text-[11.5px] text-accent-foreground">
                  SAVE20
                </span>
                <span className="text-[12.5px] text-muted-foreground">20% off · repeating</span>
              </div>
              <button className="text-[12.5px] text-danger hover:underline">Remove</button>
            </div>
          </CardShell>

          {/* Payment methods */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Payment methods</span>
              <button className="text-[12px] text-accent hover:underline">Add</button>
            </div>
            <div className="flex flex-col">
              {methods.map((m, i) => (
                <div
                  key={m.label}
                  className={`flex items-center gap-[11px] py-[9px] ${i < methods.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <m.icon className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-foreground">{m.label}</span>
                    <span className="truncate text-[11px] text-subtle-foreground">{m.sub}</span>
                  </div>
                  {m.def ? (
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-muted-foreground">Default</span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
