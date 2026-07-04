import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SidebarInset, SidebarProvider } from '@nombaone/ui/components/ui/sidebar';

import { AppSidebar } from '@/components/chrome/AppSidebar';
import { Topbar } from '@/components/chrome/Topbar';
import { getCurrentOperator } from '@/lib/auth/operator';
import { getSelectedEnvironment } from '@/lib/env';

/**
 * Dashboard chrome layout. Resolves the current operator SERVER-SIDE (the
 * `tokenVersion` instant-revocation check lives in `getCurrentOperator`, so a
 * revoked token is bounced here even though the edge gate let the signature
 * through) and the selected mode, then renders the sidebar + topbar
 * around the page. The sidebar open/closed state is seeded from its cookie at
 * SSR to avoid a hydration flash.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const operator = await getCurrentOperator();
  if (!operator) {
    redirect('/sign-in');
  }

  const mode = await getSelectedEnvironment();
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar operator={operator} />
      <SidebarInset>
        <Topbar mode={mode} />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
