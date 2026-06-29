/**
 * PARADIGM — TYPED NAV CONFIG, DECOUPLED FROM CHROME.
 *
 * The sidebar (and the topbar breadcrumb label) read from this single typed
 * source of truth rather than deriving routes from the filesystem. Two
 * behaviours it encodes:
 *
 *   • the `exact` flag — the dashboard root (`/`) matches ONLY on an exact
 *     pathname, so it does not stay lit on every child route;
 *   • LONGEST-PREFIX active detection — when several items prefix-match the
 *     current path, the most specific (longest `href`) wins, so a nested route
 *     highlights its own item and not a shallower ancestor.
 *
 * Icon names are stored as STRINGS (not component refs) because nav items cross
 * the server→client RSC boundary, and React cannot serialize a function over
 * that wire; the client resolver maps the name to an icon.
 */

export type NavIconName = 'dashboard' | 'jobs' | 'audit-log' | 'examples';

export type NavItem = {
  /** URL the item links to. */
  href: string;
  /** Sidebar label. */
  label: string;
  /** String icon identifier, resolved client-side. */
  iconName: NavIconName;
  /** When true, match only `pathname === href` (used by the dashboard root). */
  exact?: boolean;
};

export type NavGroup = {
  key: string;
  /** UPPERCASE group label. */
  label: string;
  items: NavItem[];
};

/**
 * The operator panel's destinations. Deliberately small: a dashboard home, the
 * BullMQ jobs/workers view, the append-only audit log, and the platform-wide
 * examples read view.
 */
export const NAV: NavGroup[] = [
  {
    key: 'operations',
    label: 'OPERATIONS',
    items: [
      { href: '/', label: 'Dashboard', iconName: 'dashboard', exact: true },
      { href: '/jobs', label: 'Jobs & workers', iconName: 'jobs' },
      { href: '/audit-log', label: 'Audit log', iconName: 'audit-log' },
      { href: '/examples', label: 'Examples', iconName: 'examples' },
    ],
  },
];

/**
 * Match an item against the current pathname.
 * - `exact: true` requires `pathname === href`.
 * - otherwise matches `pathname === href` OR `pathname.startsWith(href + '/')`.
 */
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

/**
 * Find the best-fit nav item for the current pathname by LONGEST matching
 * prefix. Used by the topbar breadcrumb generator and any "current section"
 * logic. Returns `null` when nothing matches.
 */
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
