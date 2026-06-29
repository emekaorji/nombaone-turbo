/**
 * The sidebar / navigation manifest, the single, explicit source of truth for
 * doc ordering and grouping. Nav order is intentional, not derived from the
 * filesystem: a page only appears in the sidebar if it is listed here, in the
 * order listed here.
 *
 * Each `slug` is the URL path under docs.nombaone.xyz (leading slash, no
 * extension); `''` is the home page. The matching MDX file is resolved by the
 * content layer (`src/lib/content.ts`) as `content/<slug>.mdx` (or
 * `content/index.mdx` for home). Pages whose `.mdx` is not yet authored are
 * fine: they render a stub until content lands (P1+).
 *
 * API resources can nest their per-operation pages under `children`; a resource
 * row links to its overview and discloses the operation pages beneath it. The
 * helpers below (`FLAT_NAV`, `findSection`, `findParentResource`) recurse so the
 * pager, slug validation, and the sidebar all treat children as first-class.
 */

export type Badge = "new" | "beta" | "updated";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ManifestItem {
  /** URL path, leading slash, no extension. `''` for home. */
  slug: string;
  /** Sidebar label. */
  title: string;
  /** Optional pill rendered next to the label. */
  badge?: Badge;
  /** HTTP method, for API operation rows (renders a method chip). */
  method?: HttpMethod;
  /** Per-operation child pages, for an API resource row. */
  children?: ManifestItem[];
}

export interface ManifestSection {
  /** Section heading shown in the sidebar (uppercased by the chrome). */
  title: string;
  /** Stable key for React lists + collapse state. */
  key: string;
  /** `"api"` rows get tighter density and the API-section treatment. */
  kind?: "docs" | "api";
  items: ManifestItem[];
}

/**
 * The home page sits outside the grouped sections (it has no section header in
 * the rail) but is still part of the routable tree.
 */
export const HOME: ManifestItem = { slug: "", title: "Home" };

export const MANIFEST: ManifestSection[] = [
  {
    title: "Getting started",
    key: "getting-started",
    items: [
      { slug: "/getting-started/quickstart", title: "Quickstart", badge: "new" },
      { slug: "/getting-started/authentication", title: "Authentication" },
      { slug: "/getting-started/environments", title: "Environments" },
    ],
  },
  {
    title: "API reference",
    key: "api",
    kind: "api",
    items: [
      { slug: "/reference/examples", title: "Create an example", method: "POST" },
    ],
  },
];

/** Depth-first flatten of an item and its children (parent before children). */
function flattenItem(item: ManifestItem): ManifestItem[] {
  return item.children
    ? [item, ...item.children.flatMap(flattenItem)]
    : [item];
}

/**
 * Flattened, ordered list of every routable page (home first, then each
 * section in manifest order, children inlined after their parent). Drives
 * prev/next paging and slug validation.
 */
export const FLAT_NAV: ManifestItem[] = [
  HOME,
  ...MANIFEST.flatMap((section) => section.items.flatMap(flattenItem)),
];

/** All routable slugs (`''` for home), in nav order. */
export const ALL_SLUGS: string[] = FLAT_NAV.map((item) => item.slug);

/**
 * The single `kind: "api"` section (the API reference), if present. The sidebar
 * renders it in its own "API Reference" view, flattened so each resource is a
 * top-level group.
 */
export const API_SECTION: ManifestSection | undefined = MANIFEST.find(
  (section) => section.kind === "api",
);

/**
 * Every non-API section (Getting started, Core concepts, Guides, References).
 * The sidebar renders these in the "Docs" view.
 */
export const DOCS_SECTIONS: ManifestSection[] = MANIFEST.filter(
  (section) => section.kind !== "api",
);

/** Look up a manifest item (label/badge) by slug. */
export function findNavItem(slug: string): ManifestItem | undefined {
  return FLAT_NAV.find((item) => item.slug === slug);
}

/** The section a slug belongs to, if any (home has none). Searches children. */
export function findSection(slug: string): ManifestSection | undefined {
  return MANIFEST.find((section) =>
    section.items.flatMap(flattenItem).some((item) => item.slug === slug),
  );
}

/**
 * The parent resource row for a slug, if the slug is one of its children. The
 * resource itself returns itself, so the sidebar can auto-open the disclosure
 * when the active path is the resource or any of its operation pages.
 */
export function findParentResource(slug: string): ManifestItem | undefined {
  for (const section of MANIFEST) {
    for (const item of section.items) {
      if (!item.children) continue;
      if (item.slug === slug || item.children.some((child) => child.slug === slug)) {
        return item;
      }
    }
  }
  return undefined;
}

/** Previous / next page in nav order, for the pager. */
export function siblings(slug: string): {
  prev: ManifestItem | null;
  next: ManifestItem | null;
} {
  const index = FLAT_NAV.findIndex((item) => item.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null,
  };
}
