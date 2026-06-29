import type { Environment } from '@nombaone/sara/context';

import { EnvSwitcher } from './EnvSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { TopbarBreadcrumb } from './TopbarBreadcrumb';

/**
 * Topbar. Server component: it receives the server-derived environment and
 * hands it to the `EnvSwitcher` island. Left: breadcrumb. Right: env switcher ·
 * theme toggle. Sticky to the top of the inset scroll container.
 */
export function Topbar({ environment }: { environment: Environment }) {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6"
    >
      <TopbarBreadcrumb />
      <div className="flex items-center gap-3">
        <EnvSwitcher value={environment} />
        <ThemeToggle />
      </div>
    </header>
  );
}
