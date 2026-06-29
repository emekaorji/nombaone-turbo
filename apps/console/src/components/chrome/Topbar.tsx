import type { Environment } from '@nombaone/sara/context';

import { EnvPill } from './EnvPill';
import { EnvSwitcher } from './EnvSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { TopbarBreadcrumbs } from './TopbarBreadcrumbs';

/**
 * Sticky topbar inside the SidebarInset scroll column.
 *   - left: breadcrumb (active nav label)
 *   - right: deployment-ring pill · test/live env switch · theme toggle
 *
 * The active `environment` is passed from the layout (resolved server-side from
 * the `console_env` cookie) so the switch renders the correct ring at SSR.
 */
export function Topbar({ environment }: { environment: Environment }) {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6"
    >
      <TopbarBreadcrumbs />
      <div className="flex items-center gap-3">
        <EnvPill />
        <EnvSwitcher environment={environment} />
        <ThemeToggle />
      </div>
    </header>
  );
}
