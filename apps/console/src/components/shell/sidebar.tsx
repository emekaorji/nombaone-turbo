'use client';

import { cn } from '@nombaone/ui/lib/utils';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/lib/auth/actions';
import { navGroups, settingsItem, isActiveHref, type NavItem } from '@/lib/nav';
import { LogoSquare } from './logo-square';

export type ShellUser = { name: string; email: string; role: string };
export type ShellOrg = { name: string };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex h-[34px] items-center gap-2.5 rounded-sm px-2.5 transition-colors',
        active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
      )}
    >
      <Icon
        className={cn('size-[17px] shrink-0', active ? 'text-accent' : 'text-muted-foreground')}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          'text-[13.5px]',
          active ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '·'
  );
}

export function Sidebar({ user, org }: { user: ShellUser; org: ShellOrg }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col gap-1 border-r border-border bg-surface-1 px-3 py-[14px]">
      {/* Brand */}
      <div className="flex h-12 items-center gap-[9px] px-2">
        <LogoSquare className="size-7" />
        <span className="text-[15px] font-semibold text-foreground">Nomba One</span>
        <span className="rounded-full bg-surface-3 px-[7px] py-0.5 font-mono text-[10px] text-subtle-foreground">
          Console
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 py-[14px]">
        {navGroups.map((group, gi) => (
          <div key={gi} className="contents">
            {group.label ? (
              <div className="px-2.5 pb-1.5 pt-[14px] font-mono text-[11px] tracking-[0.5px] text-subtle-foreground">
                {group.label}
              </div>
            ) : null}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-1">
        <NavLink item={settingsItem} active={isActiveHref(pathname, settingsItem.href)} />
        <div className="flex h-12 items-center gap-2.5 rounded bg-surface-2 px-2">
          <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-accent-muted">
            <span className="text-[11px] font-semibold text-accent">{initials(user.name)}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[13px] font-medium text-foreground">{user.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">{org.name}</span>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex size-7 items-center justify-center rounded-sm text-subtle-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            >
              <LogOut className="size-[15px]" strokeWidth={1.75} />
            </button>
          </form>
          <ChevronsUpDown className="size-[15px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
        </div>
      </div>
    </aside>
  );
}
