import { MobileBottomNav } from '@/components/shell/mobile-bottom-nav';
import { MobileTopbar } from '@/components/shell/mobile-topbar';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar */}
        <div className="hidden lg:block">
          <Topbar />
        </div>
        {/* Mobile topbar */}
        <MobileTopbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
