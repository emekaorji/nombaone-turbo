import Link from 'next/link';
import { X, LifeBuoy, CreditCard, Link2, ArrowRight } from 'lucide-react';

import { StatusBadge } from './status-badge';
import type { SubscriptionDetail, TimelineTone } from '@/lib/subscription-detail';

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex flex-1 flex-col gap-[3px] rounded bg-surface-2 px-3 py-2.5">
      <span className="font-mono text-[10px] tracking-[0.3px] text-subtle-foreground">{label}</span>
      <span className={`text-[13.5px] font-medium ${tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

const dotC: Record<TimelineTone, string> = {
  neutral: 'bg-subtle-foreground',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  upcoming: 'bg-border-strong',
};
const typeC: Record<TimelineTone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  upcoming: 'text-muted-foreground',
};

const SEND_LINK_BLOCKED = 'The billing engine emails the pay link automatically on a failed charge — there is no manual send.';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
}

/** Triage a subscription without leaving the list. URL-driven slide-over. */
export function TriageDrawer({
  detail,
  closeHref = '/subscriptions',
}: {
  detail: SubscriptionDetail | null;
  closeHref?: string;
}) {
  return (
    <div className="flex h-full w-[452px] max-w-[92vw] flex-col border-l border-border bg-surface-1 shadow-[-16px_0_48px_rgba(0,0,0,0.4)]">
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

      {!detail ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-muted-foreground">
          This subscription could not be found.
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[18px]">
            {/* Identity */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-[13px] font-medium text-muted-foreground">
                  {initials(detail.customerName)}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-foreground">{detail.customerName}</span>
                  <span className="truncate font-mono text-[11px] text-subtle-foreground">{detail.reference}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <StatusBadge status={detail.status} />
                <span className="truncate text-[12.5px] text-muted-foreground">{detail.headline}</span>
              </div>
            </div>

            {/* Quick facts */}
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <Fact label="MRR" value={detail.mrr} />
                <Fact label="RAIL" value={detail.railLabel} />
              </div>
              {detail.recovery.active ? (
                <div className="flex gap-2.5">
                  <Fact label="NEXT ATTEMPT" value={detail.recovery.info[1]?.value ?? '—'} />
                  <Fact label="ATTEMPT" value={detail.recovery.attemptLabel} tone="warning" />
                </div>
              ) : null}
            </div>

            {/* Recovery strip — only when in recovery */}
            {detail.recovery.active ? (
              <div className="flex flex-col gap-2.5 rounded-lg border border-warning bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="size-4 text-warning" strokeWidth={1.75} />
                    <span className="text-[13px] font-medium text-foreground">In recovery</span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">{detail.recovery.attemptLabel}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Recovery is engine-driven — retries are payday-timed and card-update holds never blind-retry.
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/subscriptions/${encodeURIComponent(detail.reference)}`}
                    title="Open the recovery cockpit to update the card"
                    className="flex items-center gap-1.5 rounded bg-accent px-3 py-[7px] text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                  >
                    <CreditCard className="size-3.5" strokeWidth={2} />
                    Update card
                  </Link>
                  <button
                    disabled
                    title={SEND_LINK_BLOCKED}
                    className="flex items-center gap-1.5 rounded bg-surface-3 px-3 py-[7px] text-[12.5px] font-medium text-foreground disabled:opacity-50"
                  >
                    <Link2 className="size-3.5" strokeWidth={1.75} />
                    Send pay link
                  </button>
                </div>
              </div>
            ) : null}

            {/* Mini timeline */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">RECENT ACTIVITY</span>
              {detail.timeline.length === 0 ? (
                <span className="py-2 text-[12px] text-muted-foreground">No activity yet.</span>
              ) : (
                detail.timeline
                  .slice(-4)
                  .reverse()
                  .map((e, i, arr) => (
                    <div key={i} className="flex gap-3 py-2">
                      <div className="flex w-3 flex-col items-center">
                        <span className={`mt-1 size-2 shrink-0 rounded-full ${dotC[e.tone]}`} />
                        {i < arr.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate font-mono text-[12px] ${typeC[e.tone]}`}>{e.type}</span>
                          <span className="shrink-0 text-[11px] text-subtle-foreground">{e.time}</span>
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground">{e.meta}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-[18px] py-3.5">
            <Link
              href={`/subscriptions/${encodeURIComponent(detail.reference)}`}
              className="flex items-center justify-center gap-2 rounded border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
            >
              Open full detail
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
