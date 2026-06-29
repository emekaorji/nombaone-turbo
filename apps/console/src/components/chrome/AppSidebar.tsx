'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code, Element3, Flash, Hierarchy, type Icon } from 'iconsax-react';

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

import { Wordmark } from '@/components/brand/Wordmark';
import { isActive, NAV, type NavIconName, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/cn';
import { SidebarToggle } from './SidebarToggle';
import { UserMenu, type UserMenuProps } from './UserMenu';

/**
 * Console sidebar, built on shadcn's `sidebar` block. The string icon names from
 * `nav.ts` (which had to cross the RSC boundary as serialisable strings) are
 * resolved to `iconsax-react` glyphs HERE, in a client component, via `ICON_MAP`.
 * Active items get the purple fill; the variant flips Outline→Bold.
 *
 * Behaviours inherited from shadcn for free: icon-only collapse, the mobile
 * `Sheet` drawer, Cmd/Ctrl+B toggle, and open/closed state persisted in the
 * `sidebar_state` cookie (seeded at SSR in the layout to avoid a hydration flash).
 */
const ICON_MAP: Record<NavIconName, Icon> = {
  overview: Element3,
  developers: Code,
  webhooks: Hierarchy,
  examples: Flash,
};

export function AppSidebar({ user }: { user: UserMenuProps['user'] }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group/sb-header relative h-14 flex-row items-center justify-between gap-3 border-b border-sidebar-border px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Wordmark className="group-data-[collapsible=icon]:[&_span:not(:first-child)]:hidden group-data-[collapsible=icon]:group-hover/sb-header:pointer-events-none group-data-[collapsible=icon]:group-hover/sb-header:opacity-0" />
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
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname ?? '/', item);
  const Glyph = ICON_MAP[item.iconName];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          'h-9 gap-2.5 px-3 text-sm font-medium',
          active &&
            'bg-purple-50 font-semibold text-purple-700 hover:bg-purple-50 hover:text-purple-700 data-[active=true]:bg-purple-50 data-[active=true]:text-purple-700'
        )}
      >
        <Link href={item.href} aria-current={active ? 'page' : undefined}>
          <Glyph
            size={18}
            color="currentColor"
            variant={active ? 'Bold' : 'Outline'}
            className={active ? 'text-purple-700' : 'text-muted-foreground'}
          />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
