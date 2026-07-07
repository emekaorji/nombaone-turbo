'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { getNotifications } from '@/lib/topbar-actions';
import type { EventRow, EventTone } from '@/lib/events';

const dot: Record<EventTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-subtle-foreground',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (events === null) start(async () => setEvents(await getNotifications()));
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={`flex size-9 items-center justify-center rounded transition-colors ${open ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-[60] flex w-[340px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-[13px] font-semibold text-foreground">Recent activity</span>
            <Link href="/developers/events" onClick={() => setOpen(false)} className="text-[11.5px] text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {pending || events === null ? (
              <span className="block px-4 py-6 text-center text-[12.5px] text-muted-foreground">Loading…</span>
            ) : events.length === 0 ? (
              <span className="block px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                You&apos;re all caught up. Activity appears here as your account bills and pays.
              </span>
            ) : (
              events.map((e) => (
                <Link
                  key={e.reference}
                  href={`/developers/events?event=${encodeURIComponent(e.reference)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <span className={`mt-1.5 size-[7px] shrink-0 rounded-full ${dot[e.tone]}`} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-[12px] text-foreground">{e.type}</span>
                    <span className="truncate font-mono text-[10.5px] text-subtle-foreground">{e.detail}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-subtle-foreground">{e.time}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
