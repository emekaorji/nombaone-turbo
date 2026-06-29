/**
 * Typed nav config — the single source of truth for the sidebar AND the topbar
 * breadcrumb labels. Icon names are STRINGS, not component references, because
 * `nav.ts` must serialise across the server→client RSC boundary: nav items are
 * read in a Server Component and handed to the client sidebar, and React cannot
 * pass a function (an icon component) over that wire. The string is resolved to
 * an `iconsax-react` glyph by the `ICON_MAP` in `components/chrome/AppSidebar.tsx`.
 *
 * This is the console (tenant/developer) surface — overview, developers (API
 * keys + webhooks), and the deletable example money-path slice. No billing.
 */

export type NavIconName = 'overview' | 'developers' | 'webhooks' | 'examples';

export type NavItem = {
  /** URL the item links to. */
  href: string;
  /** Display label (sentence case). */
  label: string;
  /** Icon identifier resolved client-side via ICON_MAP. */
  iconName: NavIconName;
  /**
   * Match the pathname EXACTLY (true) rather than as a prefix (false, default).
   * The overview root needs exact matching so it doesn't light up on every page.
   */
  exact?: boolean;
};

export type NavGroup = {
  key: string;
  /** UPPERCASE group label. */
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    key: 'general',
    label: 'GENERAL',
    items: [{ href: '/', label: 'Overview', iconName: 'overview', exact: true }],
  },
  {
    key: 'developers',
    label: 'DEVELOPERS',
    items: [
      { href: '/developers', label: 'API keys', iconName: 'developers', exact: true },
      { href: '/developers/webhooks', label: 'Webhooks', iconName: 'webhooks' },
    ],
  },
  {
    key: 'examples',
    label: 'EXAMPLES',
    items: [{ href: '/examples', label: 'Examples', iconName: 'examples' }],
  },
];

/**
 * Match an item against the current pathname.
 * - `exact: true` requires `pathname === href`.
 * - default matches `pathname === href` OR `pathname.startsWith(href + '/')`.
 */
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

/** Best-fit (longest-prefix) nav item for the current pathname, for breadcrumbs. */
export function findActiveItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  let bestLen = -1;
  for (const group of NAV) {
    for (const item of group.items) {
      if (!isActive(pathname, item)) continue;
      if (item.href.length > bestLen) {
        best = item;
        bestLen = item.href.length;
      }
    }
  }
  return best;
}
