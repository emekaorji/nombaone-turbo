import Link from 'next/link';
import { Plus, ChevronRight, ChevronDown, Columns3 } from 'lucide-react';

type Health = 'healthy' | 'at_risk' | 'delinquent' | 'trialing';
type Row = {
  name: string;
  email: string;
  active: number;
  total: number;
  mrr: string | null;
  credit: string | null;
  health: Health;
  joined: string;
};

const stats = [
  { value: '1,048', label: 'Total customers' },
  { value: '62', label: 'New this month' },
  { value: '690', label: 'With active subs' },
  { value: '₦340k', label: 'Credit outstanding' },
];

const tabs = [
  { label: 'All · 1,048', active: true },
  { label: 'With active subs', active: false },
  { label: 'In recovery · 37', active: false },
  { label: 'Has credit', active: false },
  { label: 'New', active: false },
];

const rows: Row[] = [
  { name: 'Mira Ltd', email: 'finance@mira.io', active: 2, total: 2, mrr: '₦150,000', credit: '₦5,000', health: 'healthy', joined: '8 Mar' },
  { name: 'Bola Foods', email: 'ops@bolafoods.ng', active: 1, total: 3, mrr: '₦40,000', credit: null, health: 'at_risk', joined: '2 Jan' },
  { name: 'Kola Retail', email: 'kola@retail.co', active: 3, total: 3, mrr: '₦360,000', credit: '₦12,000', health: 'healthy', joined: '19 Nov' },
  { name: 'Zed Studio', email: 'hey@zed.studio', active: 1, total: 1, mrr: '₦18,000', credit: null, health: 'healthy', joined: '4 Feb' },
  { name: 'Ada Obi', email: 'ada@obi.me', active: 1, total: 2, mrr: '₦40,000', credit: '₦2,500', health: 'healthy', joined: '27 Mar' },
  { name: 'Uche Media', email: 'bill@uchemedia.tv', active: 1, total: 4, mrr: '₦120,000', credit: null, health: 'at_risk', joined: '14 Jun' },
  { name: 'Tobi Co', email: 'tobi@tobi.co', active: 2, total: 2, mrr: '₦80,000', credit: null, health: 'healthy', joined: '9 May' },
  { name: 'Pau Ade', email: 'pau@ade.dev', active: 0, total: 1, mrr: null, credit: null, health: 'trialing', joined: '1 Sep' },
  { name: 'Nia Books', email: 'hello@niabooks.ng', active: 1, total: 5, mrr: '₦18,000', credit: '₦800', health: 'delinquent', joined: '22 Aug' },
];

const HEALTH: Record<Health, { label: string; text: string; dot: string }> = {
  healthy: { label: 'Healthy', text: 'text-success', dot: 'bg-success' },
  at_risk: { label: 'At risk', text: 'text-warning', dot: 'bg-warning' },
  delinquent: { label: 'Delinquent', text: 'text-danger', dot: 'bg-danger' },
  trialing: { label: 'Trialing', text: 'text-info', dot: 'bg-info' },
};

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Customers</h1>
          <p className="text-[14px] text-muted-foreground">
            Everyone who pays you, what they are worth, and who needs attention.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          New customer
        </button>
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
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
            <button
              key={t.label}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                t.active ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-subtle-foreground">Sorted by lifetime value</span>
          <ChevronDown className="size-[14px] text-subtle-foreground" strokeWidth={1.75} />
          <button className="flex size-[30px] items-center justify-center rounded border border-border text-subtle-foreground transition-colors hover:text-foreground">
            <Columns3 className="size-[15px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[880px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">CUSTOMER</span>
          <span className="w-[150px]">SUBSCRIPTIONS</span>
          <span className="w-[100px] text-right">MRR</span>
          <span className="w-[110px] text-right">CREDIT</span>
          <span className="w-[104px]">HEALTH</span>
          <span className="w-[96px]">JOINED</span>
        </div>

        {rows.map((r, i) => {
          const h = HEALTH[r.health];
          return (
            <Link
              key={r.name}
              href={`/customers/${encodeURIComponent(r.email.split('@')[0])}`}
              className={`flex min-w-[880px] items-center gap-[14px] px-4 py-3 transition-colors hover:bg-surface-2/40 ${
                i < rows.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {/* Customer */}
              <div className="flex min-w-0 flex-1 items-center gap-[11px]">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-muted-foreground">
                  {r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
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
    </div>
  );
}
