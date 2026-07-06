'use client';

import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { sectionLabel } from '@/lib/nav';
import { MobileMenu } from './mobile-menu';

export function MobileTopbar() {
  const pathname = usePathname();
  return (
    <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <MobileMenu variant="icon" />
        <span className="text-[17px] font-semibold text-foreground">{sectionLabel(pathname)}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-[9px] py-[3px]">
          <span className="size-[5px] rounded-full bg-warning" />
          <span className="text-[11px] font-medium text-warning">Sandbox</span>
        </span>
        <Bell className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
    </header>
  );
}
