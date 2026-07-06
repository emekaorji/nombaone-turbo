import { BookOpen, Copy } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
const feed: { type: string; id: string; time: string; tone: Tone; sel?: boolean }[] = [
  { type: 'invoice.payment_recovered', id: 'evt_9f2a7c4b', time: 'now', tone: 'success', sel: true },
  { type: 'subscription.created', id: 'evt_2f8c1b9e', time: '12s', tone: 'neutral' },
  { type: 'invoice.payment_failed', id: 'evt_4a1f8c6b', time: '40s', tone: 'danger' },
  { type: 'customer.updated', id: 'evt_9e7d4a1f', time: '1m', tone: 'neutral' },
  { type: 'invoice.finalized', id: 'evt_55b92014', time: '2m', tone: 'info' },
  { type: 'dunning.attempt_scheduled', id: 'evt_18d20183', time: '3m', tone: 'warning' },
  { type: 'price.created', id: 'evt_7ff20183', time: '5m', tone: 'neutral' },
  { type: 'payout.created', id: 'evt_c8e12019', time: '8m', tone: 'neutral' },
];

const dotC: Record<Tone, string> = {
  success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning', info: 'bg-info', neutral: 'bg-subtle-foreground',
};

const payload: { t: string; c: 'muted' | 'fg' | 'accent' }[] = [
  { t: '{', c: 'muted' },
  { t: '  "id": "evt_9f2a7c4b1e8d",', c: 'fg' },
  { t: '  "type": "invoice.payment_recovered",', c: 'accent' },
  { t: '  "createdAt": "2026-10-26T02:04:11Z",', c: 'fg' },
  { t: '  "data": {', c: 'fg' },
  { t: '    "reference": "nbo749201835566inv"', c: 'fg' },
  { t: '  }', c: 'fg' },
  { t: '}', c: 'muted' },
];
const lineC = { muted: 'text-muted-foreground', fg: 'text-foreground', accent: 'text-accent' };

export default function EventsPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
        <button className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong">
          <BookOpen className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
          View catalog · 34 types
        </button>
      </div>

      <DeveloperTabs />

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
        {/* Feed */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-1 lg:flex-1">
          <div className="flex items-center gap-[14px] border-b border-border px-4 py-[11px] font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">EVENT TYPE</span>
            <span className="w-[180px]">ID</span>
            <span className="w-[100px]">TIME</span>
          </div>
          {feed.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center gap-[14px] px-4 py-[11px] ${e.sel ? 'bg-surface-2' : 'hover:bg-surface-2/40'} ${i < feed.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-[9px]">
                <span className={`size-[7px] shrink-0 rounded-full ${dotC[e.tone]}`} />
                <span className="truncate font-mono text-[12.5px] text-foreground">{e.type}</span>
              </div>
              <span className="w-[180px] font-mono text-[11.5px] text-subtle-foreground">{e.id}</span>
              <span className="w-[100px] text-[12px] text-muted-foreground">{e.time}</span>
            </div>
          ))}
        </div>

        {/* Payload panel */}
        <div className="flex w-full lg:w-[400px] lg:shrink-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-foreground">Event payload</span>
            <Copy className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[12.5px] text-foreground">evt_9f2a7c4b1e8d</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-[9px] py-[3px]">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[11px] font-medium text-success">invoice.payment_recovered</span>
            </span>
          </div>
          <div className="flex flex-col gap-px overflow-auto rounded border border-border bg-background p-3.5 lg:flex-1">
            {payload.map((l, i) => (
              <span key={i} className={`whitespace-pre font-mono text-[12px] leading-[1.55] ${lineC[l.c]}`}>{l.t}</span>
            ))}
          </div>
          <span className="text-[11px] text-subtle-foreground">
            Verify with nomba.constructEvent(body, signature, secret). Dedupe on this event id.
          </span>
        </div>
      </div>
    </div>
  );
}
