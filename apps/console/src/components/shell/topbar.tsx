'use client';

import { usePathname } from 'next/navigation';
import { Search, Bell } from 'lucide-react';

import { sectionLabel } from '@/lib/nav';

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
      <span className="text-[14px] font-medium text-foreground">{sectionLabel(pathname)}</span>

      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-[7px] transition-colors hover:border-border-strong">
          <Search className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
          <span className="text-[13px] text-muted-foreground">Search</span>
          <kbd className="rounded-sm bg-surface-3 px-[5px] py-px font-mono text-[11px] text-subtle-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Sandbox / Live switch */}
        <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-[3px]">
          <div className="flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-[5px]">
            <span className="size-1.5 rounded-full bg-warning" />
            <span className="text-[12.5px] font-medium text-foreground">Sandbox</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-[5px]">
            <span className="size-1.5 rounded-full bg-subtle-foreground" />
            <span className="text-[12.5px] text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Bell */}
        <button className="flex size-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
          <Bell className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
