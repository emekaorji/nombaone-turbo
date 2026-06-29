'use client';

import { usePathname } from 'next/navigation';

import { findActiveItem } from '@/lib/nav';

/**
 * Topbar breadcrumb label, derived from the typed nav via longest-prefix
 * matching. Client-side because it depends on the live pathname.
 */
export function TopbarBreadcrumb() {
  const pathname = usePathname() ?? '/';
  const item = findActiveItem(pathname);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Operations</span>
      <span aria-hidden className="text-muted-foreground/50">
        /
      </span>
      <span className="font-semibold text-foreground">{item?.label ?? 'Dashboard'}</span>
    </nav>
  );
}
