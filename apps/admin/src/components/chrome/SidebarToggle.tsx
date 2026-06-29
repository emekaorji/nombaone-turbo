'use client';

import { PanelLeft } from 'lucide-react';
import { useSidebar } from '@nombaone/ui/components/ui/sidebar';
import { cn } from '@/lib/cn';

/**
 * Sidebar collapse toggle. Lives inside the sidebar brand row (not the topbar);
 * stays clickable in collapsed (icon-only) mode so the rail can re-expand.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { toggleSidebar, state } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
      data-sidebar="trigger"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      <PanelLeft size={18} />
    </button>
  );
}
