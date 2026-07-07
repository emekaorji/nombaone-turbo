'use client';

import { Building2, Plug, SlidersHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/settings', label: 'Organization', icon: Building2 },
  { href: '/settings/billing', label: 'Billing settings', icon: SlidersHorizontal },
  { href: '/settings/team', label: 'Team', icon: Users },
  { href: '/settings/connection', label: 'Nomba connection', icon: Plug },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-0.5">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-[7px] rounded px-3 py-2 text-[13px] transition-colors ${active ? 'bg-surface-2 font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className={`size-[15px] ${active ? 'text-accent' : 'text-muted-foreground'}`} strokeWidth={1.75} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
