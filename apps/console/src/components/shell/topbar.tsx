'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setModeAction } from '@/lib/auth/actions';
import type { SessionMode } from '@/lib/auth';
import { sectionLabel } from '@/lib/nav';
import { CommandPalette } from '@/components/shell/command-palette';
import { NotificationBell } from '@/components/shell/notification-bell';

export function Topbar({ mode }: { mode: SessionMode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchMode(next: SessionMode) {
    if (next === mode || pending) return;
    startTransition(async () => {
      await setModeAction(next);
      router.refresh();
    });
  }

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
      <span className="text-[14px] font-medium text-foreground">{sectionLabel(pathname)}</span>

      <div className="flex items-center gap-3">
        {/* Search — ⌘K command palette (jump-to + live entity search) */}
        <CommandPalette />

        {/* Sandbox / Live switch — flips org_sessions.mode, re-scopes every read */}
        <div className={`flex items-center gap-0.5 rounded-full bg-surface-2 p-[3px] ${pending ? 'opacity-70' : ''}`}>
          <button
            type="button"
            onClick={() => switchMode('sandbox')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-[5px] transition-colors ${mode === 'sandbox' ? 'bg-surface-3' : 'hover:bg-surface-3/50'}`}
          >
            <span className={`size-1.5 rounded-full ${mode === 'sandbox' ? 'bg-warning' : 'bg-subtle-foreground'}`} />
            <span
              className={`text-[12.5px] ${mode === 'sandbox' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            >
              Sandbox
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('live')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-[5px] transition-colors ${mode === 'live' ? 'bg-surface-3' : 'hover:bg-surface-3/50'}`}
          >
            <span className={`size-1.5 rounded-full ${mode === 'live' ? 'bg-accent' : 'bg-subtle-foreground'}`} />
            <span className={`text-[12.5px] ${mode === 'live' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              Live
            </span>
          </button>
        </div>

        {/* Notifications — recent domain-event popover */}
        <NotificationBell />
      </div>
    </header>
  );
}
