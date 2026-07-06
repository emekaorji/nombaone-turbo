import {
  LayoutDashboard,
  RefreshCw,
  Users,
  Layers,
  FileText,
  CreditCard,
  Activity,
  Banknote,
  Ticket,
  Code,
  Scale,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

/** Sidebar nav, 1:1 with NOMBAONE.pen shell (sidebar pkZGn). */
export const navGroups: NavGroup[] = [
  { items: [{ label: 'Overview', href: '/', icon: LayoutDashboard }] },
  {
    label: 'BILLING',
    items: [
      { label: 'Subscriptions', href: '/subscriptions', icon: RefreshCw },
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Plans and prices', href: '/plans', icon: Layers },
      { label: 'Invoices', href: '/invoices', icon: FileText },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { label: 'Payments and rails', href: '/payments', icon: CreditCard },
      { label: 'Dunning and recovery', href: '/dunning', icon: Activity },
      { label: 'Settlements and payouts', href: '/settlements', icon: Banknote },
      { label: 'Coupons and credits', href: '/coupons', icon: Ticket },
    ],
  },
  {
    label: 'BUILD',
    items: [
      { label: 'Developers', href: '/developers', icon: Code },
      { label: 'Reconciliation', href: '/reconciliation', icon: Scale },
    ],
  },
];

export const settingsItem: NavItem = { label: 'Settings', href: '/settings', icon: Settings };

export function allNavItems(): NavItem[] {
  return [...navGroups.flatMap((g) => g.items), settingsItem];
}

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function sectionLabel(pathname: string): string {
  const match = allNavItems().find((i) => isActiveHref(pathname, i.href));
  return match?.label ?? 'Overview';
}
