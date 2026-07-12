/**
 * The nav overlay: localized STRINGS only. Structure stays in `content/manifest.ts`,
 * which remains the single source of truth for slugs, order, nesting and badges.
 *
 * The overlay is deliberately PARTIAL. A key that is absent falls back to
 * English, and that is the correct behaviour rather than a gap: the sidebar
 * entries for the frozen-English trees (`/reference`, `/sdks`, `/errors`) lead
 * to English pages, so an English label is telling the truth about where the
 * link goes. Only pages that are actually translated get a translated label.
 */
export interface NavOverlay {
  /** Manifest section key → section title. */
  sections: Record<string, string>;
  /** Slug → the page's translated title/summary. Filled by the translation pipeline. */
  items: Record<string, { title: string; summary?: string }>;
}
