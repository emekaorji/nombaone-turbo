'use client';

import { SidebarLeft } from 'iconsax-react';

import { useSidebar } from '@nombaone/ui/components/ui/sidebar';
import { cn } from '@/lib/cn';

/**
 * The sidebar collapse trigger, living inside the sidebar header. Wraps shadcn's
 * `useSidebar().toggleSidebar()` so the open/closed state (persisted in the
 * `sidebar_state` cookie by `SidebarProvider`) flips on click — and via the
 * Cmd/Ctrl+B shortcut the provider wires for free.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <SidebarLeft size={18} color="currentColor" variant="Outline" />
    </button>
  );
}
