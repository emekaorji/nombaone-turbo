export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BookOpen, Radio } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';
import { EmptyState } from '@/components/console/empty-state';
import { getEventsView, type EventTone } from '@/lib/events';

const dotC: Record<EventTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-subtle-foreground',
};
const badgeText: Record<EventTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-foreground',
};
const lineC = { muted: 'text-muted-foreground', fg: 'text-foreground', accent: 'text-accent' };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const sp = await searchParams;
  const { feed, detail, total } = await getEventsView(sp.event);

  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
        <Link
          href="https://docs.nombaone.xyz/webhooks/event-catalog"
          target="_blank"
          rel="noopener noreferrer"
          title="Open the full event catalog in the docs"
          className="flex items-center gap-[7px] rounded border border-border bg-surface-2 px-3.5 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
        >
          <BookOpen className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
          Event catalog
        </Link>
      </div>

      <DeveloperTabs />

      {total === 0 ? (
        <EmptyState
          icon={Radio}
          iconTone="accent"
          title="No events yet"
          titleSize={16}
          description={'Every state change emits a domain event here — the same\nfeed that drives your webhooks. Create a customer or plan to see one.'}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
          {/* Feed */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-1 lg:flex-1">
            <div className="flex items-center gap-[14px] border-b border-border px-4 py-[11px] font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
              <span className="flex-1">EVENT TYPE</span>
              <span className="w-[180px]">ID</span>
              <span className="w-[100px]">TIME</span>
            </div>
            {feed.map((e, i) => (
              <Link
                key={e.reference}
                href={`/developers/events?event=${encodeURIComponent(e.reference)}`}
                scroll={false}
                className={`flex items-center gap-[14px] px-4 py-[11px] ${e.selected ? 'bg-surface-2' : 'hover:bg-surface-2/40'} ${i < feed.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-[9px]">
                  <span className={`size-[7px] shrink-0 rounded-full ${dotC[e.tone]}`} />
                  <span className="truncate font-mono text-[12.5px] text-foreground">{e.type}</span>
                </div>
                <span className="w-[180px] truncate font-mono text-[11.5px] text-subtle-foreground">{e.reference}</span>
                <span className="w-[100px] text-[12px] text-muted-foreground">{e.time}</span>
              </Link>
            ))}
          </div>

          {/* Payload panel */}
          <div className="flex w-full lg:w-[400px] lg:shrink-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface-1 p-4">
            <span className="text-[14px] font-semibold text-foreground">Event payload</span>
            {detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[12.5px] text-foreground">{detail.reference}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-[9px] py-[3px]">
                    <span className={`size-1.5 rounded-full ${dotC[detail.tone]}`} />
                    <span className={`text-[11px] font-medium ${badgeText[detail.tone]}`}>{detail.type}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-px overflow-auto rounded border border-border bg-background p-3.5 lg:flex-1">
                  {detail.lines.map((l, i) => (
                    <span key={i} className={`whitespace-pre font-mono text-[12px] leading-[1.55] ${lineC[l.c]}`}>{l.t}</span>
                  ))}
                </div>
                <span className="text-[11px] text-subtle-foreground">
                  Verify with nomba.constructEvent(body, signature, secret). Dedupe on this event id.
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
