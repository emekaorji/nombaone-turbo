import { cookies } from 'next/headers';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { SidebarInset, SidebarProvider } from '@nombaone/ui/components/ui/sidebar';

import { AppSidebar, Topbar } from '@/components/chrome';
import { requireUser } from '@/lib/auth-context';
import { getEnvironment } from '@/lib/environment';

/**
 * (app) route group — the signed-IN surface. Every tenant-facing screen lives
 * here and shares the sidebar + topbar. `requireUser()` validates the session
 * (cookie → DB) and redirects to /login when absent, so every child RSC can
 * assume an authenticated user; the active ring is resolved from the
 * `console_env` cookie and handed to the topbar switch.
 *
 * `SidebarProvider` owns open/closed state and persists it to `sidebar_state`;
 * we seed `defaultOpen` from that cookie at SSR so the preference survives
 * reloads without a hydration flash.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, mode, cookieStore] = await Promise.all([
    requireUser(),
    getEnvironment(),
    cookies(),
  ]);
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <NuqsAdapter>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar user={user} />
        <SidebarInset>
          <Topbar mode={mode} />
          <div className="flex-1 px-6 py-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NuqsAdapter>
  );
}
