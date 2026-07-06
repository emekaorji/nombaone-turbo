import { ArrowRight, ChevronDown, CreditCard, FastForward, FlaskConical, Plus, Send, Webhook } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';

const outcomes = [
  { id: 'success', selected: true },
  { id: 'decline_insufficient_funds', selected: false },
  { id: 'decline_expired_card', selected: false },
  { id: 'decline_do_not_honor', selected: false },
  { id: 'requires_otp', selected: false },
];

export default function TestModePage() {
  return (
    <div className="flex h-full flex-col gap-[18px] px-7 py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
      </div>

      <DeveloperTabs />

      {/* Env banner */}
      <div className="flex items-center gap-2.5 rounded-[14px] border border-warning bg-warning-bg px-3.5 py-3">
        <FlaskConical className="size-4 shrink-0 text-warning" strokeWidth={1.75} />
        <p className="text-[12.5px] text-foreground">
          Test mode is pinned to this deployment (INFRA_ENVIRONMENT=test). These instruments do not exist on live, and
          live behavior is byte-identical.
        </p>
      </div>

      {/* Instruments */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Mint a test method */}
        <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
              <CreditCard className="size-[17px] text-accent" strokeWidth={1.75} />
            </div>
            <span className="text-[14.5px] font-semibold text-foreground">Mint a test method</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Deterministic outcomes, driven by test_* sentinels short-circuited at both collect sites.
          </p>
          <div className="flex flex-1 flex-col gap-1.5">
            {outcomes.map((o) => (
              <div
                key={o.id}
                className={`flex items-center gap-[9px] rounded px-2.5 py-2 ${o.selected ? 'border border-accent-border bg-surface-2' : ''}`}
              >
                {o.selected ? (
                  <span className="grid size-[14px] shrink-0 place-items-center rounded-full border-[3px] border-accent bg-accent">
                    <span className="size-1 rounded-full bg-accent-foreground" />
                  </span>
                ) : (
                  <span className="size-[14px] shrink-0 rounded-full border border-border-strong bg-surface-3" />
                )}
                <span className={`font-mono text-[12px] ${o.selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {o.id}
                </span>
              </div>
            ))}
          </div>
          <button className="flex items-center justify-center gap-2 rounded bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
            <Plus className="size-[15px]" strokeWidth={2} />
            Mint method
          </button>
        </div>

        {/* Advance the clock */}
        <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
              <FastForward className="size-[17px] text-accent" strokeWidth={1.75} />
            </div>
            <span className="text-[14.5px] font-semibold text-foreground">Advance the clock</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Move a subscription to its next cycle. Idempotent per period, active or trialing only.
          </p>
          <button className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
            <span className="font-mono text-[12.5px] text-foreground">nbo749201835566sub</span>
            <ChevronDown className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
          </button>
          <div className="flex flex-1 items-center justify-center gap-3">
            <span className="text-[13px] text-muted-foreground">period 4</span>
            <ArrowRight className="size-[18px] text-accent" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-foreground">period 5</span>
          </div>
          <button className="flex items-center justify-center gap-2 rounded bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
            <FastForward className="size-[15px]" strokeWidth={2} />
            Advance cycle
          </button>
        </div>

        {/* Simulate a webhook */}
        <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-[18px]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
              <Webhook className="size-[17px] text-accent" strokeWidth={1.75} />
            </div>
            <span className="text-[14.5px] font-semibold text-foreground">Simulate a webhook</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Emit a real, signed catalog event to your endpoint, so you can watch it arrive.
          </p>
          <button className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
            <span className="font-mono text-[12.5px] text-foreground">invoice.payment_recovered</span>
            <ChevronDown className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
          </button>
          <div className="flex-1" />
          <button className="flex items-center justify-center gap-2 rounded bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
            <Send className="size-[15px]" strokeWidth={2} />
            Send event
          </button>
        </div>
      </div>
    </div>
  );
}
