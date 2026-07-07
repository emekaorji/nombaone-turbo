'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound, Webhook, Radio, ScrollText, FlaskConical } from 'lucide-react';
import { cn } from '@nombaone/ui/lib/utils';

const tabs = [
  { label: 'API keys', href: '/developers', icon: KeyRound },
  { label: 'Webhooks', href: '/developers/webhooks', icon: Webhook },
  { label: 'Events', href: '/developers/events', icon: Radio },
  { label: 'Logs', href: '/developers/logs', icon: ScrollText },
  { label: 'Test mode', href: '/developers/test', icon: FlaskConical },
];

export function DeveloperTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-0.5">
      {tabs.map((t) => {
        const active = t.href === '/developers' ? pathname === '/developers' : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'flex items-center gap-[7px] rounded px-3 py-2 transition-colors',
              active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
            )}
          >
            <Icon className={cn('size-[15px]', active ? 'text-accent' : 'text-muted-foreground')} strokeWidth={1.75} />
            <span className={cn('text-[13px]', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
