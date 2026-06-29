'use client';

import { usePathname } from 'next/navigation';

import { findActiveItem } from '@/lib/nav';

/**
 * Topbar breadcrumb — the active nav item's label, driven by the typed `nav.ts`
 * config (the single source of truth for labels). Falls back to "Overview" at
 * the root.
 */
export function TopbarBreadcrumbs() {
  const pathname = usePathname() ?? '/';
  const item = findActiveItem(pathname);
  const label = item?.label ?? 'Overview';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
    </nav>
  );
}
