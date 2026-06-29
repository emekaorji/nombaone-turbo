'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowSwapVertical, Logout, ProfileCircle } from 'iconsax-react';
import { toast } from 'sonner';

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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@nombaone/ui/components/ui/sidebar';

import { signOutAction } from '@/lib/auth-actions';
import { ROLE_LABEL, type OrgUserRole } from '@/lib/rbac';

export interface UserMenuProps {
  user: { name: string; email: string; role: OrgUserRole };
}

/** Two-letter initials from a name, for the avatar fallback. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Sidebar-footer identity + account menu. "Sign out" calls the `signOutAction`
 * server action (revokes the session row + clears the cookie), then hard-pushes
 * to /login so the layout re-evaluates with no session.
 */
export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onSignOut = () => {
    startTransition(async () => {
      const result = await signOutAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.replace('/login');
      router.refresh();
    });
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
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
              </div>
              <ArrowSwapVertical
                size={16}
                color="currentColor"
                variant="Outline"
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
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email} · {ROLE_LABEL[user.role]}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <ProfileCircle size={16} color="currentColor" variant="Outline" />
              Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(e) => {
                e.preventDefault();
                onSignOut();
              }}
            >
              <Logout size={16} color="currentColor" variant="Outline" />
              {pending ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
