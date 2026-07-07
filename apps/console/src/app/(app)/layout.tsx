import { MobileBottomNav } from '@/components/shell/mobile-bottom-nav';
import { MobileTopbar } from '@/components/shell/mobile-topbar';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { requireSession } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const user = { name: session.user.name, email: session.user.email, role: session.user.role };
  const org = { name: session.org.name };

  return (
    <div className="flex h-screen overflow-hidden bg-background print:h-auto print:overflow-visible">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block print:!hidden">
        <Sidebar user={user} org={org} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar */}
        <div className="hidden lg:block print:!hidden">
          <Topbar mode={session.mode} />
        </div>
        {/* Mobile topbar */}
        <div className="print:hidden lg:contents">
          <MobileTopbar mode={session.mode} user={user} org={org} />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
        {/* Mobile bottom nav */}
        <div className="print:hidden lg:contents">
          <MobileBottomNav user={user} org={org} />
        </div>
      </div>
    </div>
  );
}
