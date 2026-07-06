import Link from 'next/link';
import { X, LifeBuoy, CreditCard, Link2, ArrowRight } from 'lucide-react';

import { StatusBadge } from './status-badge';

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex flex-1 flex-col gap-[3px] rounded bg-surface-2 px-3 py-2.5">
      <span className="font-mono text-[10px] tracking-[0.3px] text-subtle-foreground">{label}</span>
      <span className={`text-[13.5px] font-medium ${tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

type Tone = 'success' | 'danger' | 'warning';
const events: { type: string; meta: string; time: string; tone: Tone }[] = [
  { type: 'dunning.attempt_scheduled', meta: 'payday-timed · 26 Sep', time: 'now', tone: 'warning' },
  { type: 'invoice.payment_failed', meta: 'insufficient_funds · attempt 2', time: '12 Sep', tone: 'danger' },
  { type: 'invoice.payment_failed', meta: 'insufficient_funds · attempt 1', time: '1 Sep', tone: 'danger' },
];
const dotC: Record<Tone, string> = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning' };
const typeC: Record<Tone, string> = { success: 'text-success', danger: 'text-danger', warning: 'text-warning' };

/** Triage a subscription without leaving the list. URL-driven slide-over. */
export function TriageDrawer({ closeHref = '/subscriptions' }: { closeHref?: string }) {
  return (
    <div className="flex h-full w-[452px] flex-col border-l border-border bg-surface-1 shadow-[-16px_0_48px_rgba(0,0,0,0.4)]">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[15px]">
        <span className="text-[13px] font-medium text-muted-foreground">Subscription</span>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} />
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[18px]">
        {/* Identity */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-[13px] font-medium text-muted-foreground">
              BF
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-foreground">Bola Foods</span>
              <span className="font-mono text-[11px] text-subtle-foreground">nbo2mp…cus</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusBadge status="past_due" />
            <span className="text-[12.5px] text-muted-foreground">Team Monthly</span>
          </div>
        </div>

        {/* Quick facts */}
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <Fact label="MRR" value="₦40,000/mo" />
            <Fact label="RAIL" value="Direct debit" />
          </div>
          <div className="flex gap-2.5">
            <Fact label="NEXT ATTEMPT" value="26 Sep" />
            <Fact label="GRACE LEFT" value="41h" tone="warning" />
          </div>
        </div>

        {/* Recovery strip */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-warning bg-surface-2 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-warning" strokeWidth={1.75} />
              <span className="text-[13px] font-medium text-foreground">In recovery</span>
            </div>
            <span className="text-[12px] text-muted-foreground">attempt 3 of 4</span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Next attempt 26 Sep, timed for payday. Waiting genuinely helps here.
          </p>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 rounded bg-accent px-3 py-[7px] text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              <CreditCard className="size-3.5" strokeWidth={2} />
              Update card
            </button>
            <button className="flex items-center gap-1.5 rounded bg-surface-3 px-3 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-2">
              <Link2 className="size-3.5" strokeWidth={1.75} />
              Send pay link
            </button>
          </div>
        </div>

        {/* Mini timeline */}
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">RECENT ACTIVITY</span>
          {events.map((e, i) => (
            <div key={i} className="flex gap-3 py-2">
              <div className="flex w-3 flex-col items-center">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${dotC[e.tone]}`} />
                {i < events.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate font-mono text-[12px] ${typeC[e.tone]}`}>{e.type}</span>
                  <span className="shrink-0 text-[11px] text-subtle-foreground">{e.time}</span>
                </div>
                <span className="truncate text-[11px] text-muted-foreground">{e.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-[18px] py-3.5">
        <Link
          href="/subscriptions/nbo2mp901835566sub"
          className="flex items-center justify-center gap-2 rounded border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
        >
          Open full detail
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
