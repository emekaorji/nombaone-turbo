'use client';

import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';

import type { SessionMode } from '@/lib/auth';
import { sectionLabel } from '@/lib/nav';
import { MobileMenu } from './mobile-menu';
import type { ShellOrg, ShellUser } from './sidebar';

export function MobileTopbar({ mode, user, org }: { mode: SessionMode; user: ShellUser; org: ShellOrg }) {
  const pathname = usePathname();
  const live = mode === 'live';
  return (
    <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <MobileMenu variant="icon" user={user} org={org} />
        <span className="text-[17px] font-semibold text-foreground">{sectionLabel(pathname)}</span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${live ? 'bg-accent-muted' : 'bg-warning-bg'}`}
        >
          <span className={`size-[5px] rounded-full ${live ? 'bg-accent' : 'bg-warning'}`} />
          <span className={`text-[11px] font-medium ${live ? 'text-accent' : 'text-warning'}`}>
            {live ? 'Live' : 'Sandbox'}
          </span>
        </span>
        <Bell className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
    </header>
  );
}
