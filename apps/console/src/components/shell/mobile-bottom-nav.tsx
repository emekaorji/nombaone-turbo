'use client';

import { Activity, Code, LayoutDashboard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActiveHref } from '@/lib/nav';
import { MobileMenu } from './mobile-menu';
import type { ShellOrg, ShellUser } from './sidebar';

const tabs = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Subs', href: '/subscriptions', icon: RefreshCw },
  { label: 'Recovery', href: '/dunning', icon: Activity },
  { label: 'Build', href: '/developers', icon: Code },
];

export function MobileBottomNav({ user, org }: { user: ShellUser; org: ShellOrg }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-[62px] shrink-0 items-stretch border-t border-border bg-background px-1 lg:hidden">
      {tabs.map((t) => {
        const active = isActiveHref(pathname, t.href);
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className="flex flex-1 flex-col items-center justify-center gap-[3px]">
            <Icon className={`size-5 ${active ? 'text-accent' : 'text-muted-foreground'}`} strokeWidth={1.75} />
            <span className={`text-[10px] ${active ? 'font-medium text-accent' : 'text-muted-foreground'}`}>
              {t.label}
            </span>
          </Link>
        );
      })}
      <MobileMenu variant="tab" user={user} org={org} />
    </nav>
  );
}
