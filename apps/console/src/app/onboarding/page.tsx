import { Check, CreditCard } from 'lucide-react';

import { LogoMark } from '@/components/shell/logo-mark';

type Item = {
  n: number;
  title: string;
  desc: string;
  state: 'done' | 'current' | 'pending';
  cta?: string;
};

const items: Item[] = [
  { n: 1, title: 'Create a customer', desc: 'Ada Obi, ada@shop.io', state: 'done' },
  { n: 2, title: 'Create a plan and price', desc: 'Pro Monthly, ₦12,000 / month', state: 'done' },
  {
    n: 3,
    title: 'Add a payment method',
    desc: 'Use a test card to stand in for a real one. No real money moves.',
    state: 'current',
    cta: 'Use a test card',
  },
  { n: 4, title: 'Start your first subscription', desc: 'Pick the customer, the price, and the rail.', state: 'pending' },
  {
    n: 5,
    title: 'Watch it bill in sandbox mode',
    desc: 'Advance the clock and see the invoice, the charge, and a recovery, on real API calls.',
    state: 'pending',
  },
];

function StepCircle({ item }: { item: Item }) {
  if (item.state === 'done') {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
        <Check className="size-[15px] text-accent-foreground" strokeWidth={2.5} />
      </span>
    );
  }
  if (item.state === 'current') {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-muted ring-2 ring-inset ring-accent">
        <span className="text-[13px] font-semibold text-accent">{item.n}</span>
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3">
      <span className="text-[13px] font-medium text-subtle-foreground">{item.n}</span>
    </span>
  );
}

export default function OnboardingPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Topbar */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
        <div className="flex items-center gap-[9px]">
          <span className="flex size-7 items-center justify-center rounded bg-accent">
            <LogoMark className="w-4 text-accent-foreground" />
          </span>
          <span className="text-[15px] font-semibold text-foreground">Nomba One</span>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-warning" />
            <span className="text-[12px] font-medium text-warning">Sandbox</span>
          </span>
          <button className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            Skip to console
          </button>
        </div>
      </header>

      {/* Centered content */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-14">
        <div className="flex w-[720px] flex-col gap-[22px]">
          {/* Welcome */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] font-semibold tracking-[-0.6px] text-foreground">Welcome, Emeka.</h1>
            <p className="text-[15px] text-muted-foreground">
              Let&apos;s get your first subscription billing in sandbox mode. Five steps, a few minutes.
            </p>
          </div>

          {/* Progress */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">2 of 5 complete</span>
              <span className="font-mono text-[12.5px] text-accent">40%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent" style={{ width: '40%' }} />
            </div>
          </div>

          {/* Checklist */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1">
            {items.map((item, i) => (
              <div
                key={item.n}
                className={`flex gap-3.5 px-[18px] py-4 ${i < items.length - 1 ? 'border-b border-border' : ''}`}
              >
                <StepCircle item={item} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[14px] font-medium ${item.state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      {item.title}
                    </span>
                    {item.state === 'done' ? <span className="text-[12px] text-success">Done</span> : null}
                  </div>
                  <p className="text-[12.5px] text-subtle-foreground">{item.desc}</p>
                  {item.cta ? (
                    <button className="mt-1 inline-flex w-fit items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                      <CreditCard className="size-[15px]" strokeWidth={2} />
                      {item.cta}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Foot */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[13px] text-muted-foreground">Prefer to explore first?</span>
            <button className="text-[13px] font-medium text-accent hover:opacity-80">Skip to the console</button>
          </div>
        </div>
      </div>
    </div>
  );
}
