import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

function NumIn({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3 py-2">
      <span className="font-mono text-[13px] text-foreground">{value}</span>
      <span className="text-[12px] text-subtle-foreground">{unit}</span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {items.map((c) => (
        <span key={c} className="rounded-full bg-surface-3 px-2.5 py-1 font-mono text-[11.5px] text-muted-foreground">
          {c}
        </span>
      ))}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={`flex h-[22px] w-[38px] items-center rounded-full px-[3px] ${on ? 'justify-end bg-accent' : 'justify-start bg-surface-3'}`}
    >
      <span className={`size-4 rounded-full ${on ? 'bg-accent-foreground' : 'bg-muted-foreground'}`} />
    </div>
  );
}

function Select({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded border border-border bg-surface-2 px-3 py-2">
      <span className="font-mono text-[12.5px] text-foreground">{value}</span>
      <ChevronDown className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
    </div>
  );
}

type Row = { label: string; desc: string; control: ReactNode };
function SettingCard({ title, subtitle, rows }: { title: string; subtitle?: string; rows: Row[] }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface-1 px-5 py-[18px]">
      <div className="flex flex-col gap-[3px]">
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle ? <span className="text-[12.5px] text-muted-foreground">{subtitle}</span> : null}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-5 py-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-foreground">{r.label}</span>
            <span className="text-[11.5px] text-subtle-foreground">{r.desc}</span>
          </div>
          {r.control}
        </div>
      ))}
    </div>
  );
}

const retryRows: Row[] = [
  { label: 'Maximum attempts', desc: 'Then the subscription churns involuntarily.', control: <NumIn value="4" unit="attempts" /> },
  { label: 'Retry intervals', desc: 'Hours after each failure.', control: <Chips items={['24h', '72h', '120h', '168h']} /> },
  { label: 'Grace period', desc: 'How long the subscriber keeps access.', control: <NumIn value="72" unit="hours" /> },
  { label: 'Maximum window', desc: 'Give up after this long.', control: <NumIn value="336" unit="hours · 14 days" /> },
];

const paydayRows: Row[] = [
  { label: 'Payday bias', desc: 'Time retries to the salary window.', control: <Toggle on /> },
  { label: 'Payday days', desc: 'Days of the month to prefer.', control: <Chips items={['26', '27', '28', '29', '30', '1']} /> },
  { label: 'Pull-forward window', desc: 'Snap forward up to this many days.', control: <NumIn value="4" unit="days" /> },
];

const collectionRows: Row[] = [
  {
    label: 'Partial collection',
    desc: 'Accept a partial payment against an open invoice. Off by default.',
    control: <Toggle on={false} />,
  },
  {
    label: 'Default collection method',
    desc: 'How new subscriptions collect unless overridden.',
    control: <Select value="charge_automatically" />,
  },
  { label: 'Customer communications', desc: 'Send dunning emails and pay-link nudges.', control: <Toggle on /> },
];

export default function BillingSettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto">
      <SettingCard title="Retry policy" subtitle="How dunning retries a failed charge." rows={retryRows} />
      <SettingCard
        title="Payday timing"
        subtitle="Retries snap forward onto payday, because a thin balance usually means not yet."
        rows={paydayRows}
      />
      <SettingCard title="Collection" rows={collectionRows} />
      <div className="flex items-center justify-end gap-2.5">
        <button className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong">
          Discard
        </button>
        <button className="rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          Save policy
        </button>
      </div>
    </div>
  );
}
