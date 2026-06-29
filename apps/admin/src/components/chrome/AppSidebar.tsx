'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronsUpDown,
  Cpu,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ScrollText,
  type LucideProps,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@nombaone/ui/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nombaone/ui/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@nombaone/ui/components/ui/sidebar';

import { SidebarToggle } from './SidebarToggle';
import { LogoIcon } from '@/components/brand/LogoIcon';
import { isActive, NAV, type NavIconName, type NavItem } from '@/lib/nav';
import type { Operator } from '@/lib/auth/operator';
import { cn } from '@/lib/cn';

/**
 * Operator-panel sidebar, built on the shadcn `sidebar` block. The nav reads
 * from the typed `NAV` config (`@/lib/nav`); the active item uses longest-prefix
 * detection. The footer carries the operator identity + a sign-out action.
 * String icon names are resolved here (the config crosses the RSC boundary and
 * cannot carry component refs).
 */

const ICON_MAP: Record<NavIconName, ComponentType<LucideProps>> = {
  dashboard: LayoutDashboard,
  jobs: Cpu,
  'audit-log': ScrollText,
  examples: ListChecks,
};

export function AppSidebar({ operator }: { operator: Operator | null }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group/sb-header relative h-14 flex-row items-center justify-between gap-3 border-b border-sidebar-border px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <BrandMark className="transition-opacity group-data-[collapsible=icon]:group-hover/sb-header:pointer-events-none group-data-[collapsible=icon]:group-hover/sb-header:opacity-0" />
        <SidebarToggle className="transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:m-auto group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:group-hover/sb-header:pointer-events-auto group-data-[collapsible=icon]:group-hover/sb-header:opacity-100" />
      </SidebarHeader>
      <SidebarContent className="gap-3 px-3 py-4">
        {NAV.map((group) => (
          <SidebarGroup key={group.key} className="gap-1 p-0">
            <SidebarGroupLabel className="h-auto px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.6px] text-neutral-400">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavRow key={item.href} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <ProfileMenu operator={operator} />
      </SidebarFooter>
    </Sidebar>
  );
}

/* ------------------------------------------------------------------------- */

function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex min-w-0 items-center gap-2.5 truncate', className)}>
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-sm bg-primary">
        <LogoIcon className="size-3.5 text-purple-50" />
      </span>
      <span className="text-base font-bold tracking-[-0.2px] text-foreground group-data-[collapsible=icon]:hidden">
        Nombaone
      </span>
      <span className="mt-0.5 rounded-xs bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.5px] text-neutral-600 group-data-[collapsible=icon]:hidden">
        ADMIN
      </span>
    </Link>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname ?? '/', item);
  const Icon = ICON_MAP[item.iconName];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          'h-9 gap-2.5 px-3 text-[14px] font-medium',
          active &&
            'bg-purple-50 font-semibold text-purple-700 hover:bg-purple-50 hover:text-purple-700 data-[active=true]:bg-purple-50 data-[active=true]:text-purple-700'
        )}
      >
        <Link href={item.href} aria-current={active ? 'page' : undefined}>
          <Icon
            size={18}
            className={active ? 'text-purple-700' : 'text-muted-foreground'}
          />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ProfileMenu({ operator }: { operator: Operator | null }) {
  const op = operator ?? {
    id: '',
    name: 'Unknown operator',
    email: '',
    role: 'viewer' as const,
    initials: '??',
  };

  const onSignOut = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      // Hard navigation so the route gate re-evaluates with the cleared cookie.
      window.location.href = '/sign-in';
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-12 gap-2.5 hover:bg-muted data-[state=open]:bg-muted"
            >
              <Avatar className="size-9 rounded-full">
                <AvatarFallback className="rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                  {op.initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[13px] font-semibold text-foreground">{op.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{op.email}</span>
              </div>
              <ChevronsUpDown
                size={16}
                className="text-muted-foreground group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
          >
            <DropdownMenuLabel className="flex items-center gap-2 p-2">
              <Avatar className="size-9 rounded-full">
                <AvatarFallback className="rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                  {op.initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold text-foreground">{op.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {op.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                void onSignOut();
              }}
            >
              <LogOut size={16} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
