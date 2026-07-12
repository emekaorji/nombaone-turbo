import { NAV_HA } from "@content/l10n/nav.ha";
import { NAV_YO } from "@content/l10n/nav.yo";
import { MANIFEST, findNavItem } from "@content/manifest";

import { DEFAULT_LOCALE, type Locale } from "./config";

import type { NavOverlay } from "@content/l10n/types";

/**
 * Nav strings, per locale.
 *
 * `content/manifest.ts` stays the one structural SSOT — slugs, order, nesting,
 * badges, `siblings()`. Not a line of it changes. This only overlays the words
 * on top, keyed by slug, and falls back to English for anything it does not
 * cover — which is the right answer for the frozen-English trees, whose sidebar
 * entries lead to English pages and should say so.
 */

const OVERLAYS: Partial<Record<Locale, NavOverlay>> = {
  yo: NAV_YO,
  ha: NAV_HA,
};

export function navTitle(slug: string, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const english = findNavItem(slug)?.title;
  if (locale === DEFAULT_LOCALE) return english;
  return OVERLAYS[locale]?.items[slug]?.title ?? english;
}

export function navSummary(slug: string, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const english = findNavItem(slug)?.summary;
  if (locale === DEFAULT_LOCALE) return english;
  return OVERLAYS[locale]?.items[slug]?.summary ?? english;
}

/**
 * Section title by manifest KEY (`"concepts"`), not by slug — note this differs
 * from `findSection(slug)` in the manifest, which resolves a page to its owning
 * section.
 */
export function sectionTitle(key: string, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const english = MANIFEST.find((section) => section.key === key)?.title;
  if (locale === DEFAULT_LOCALE) return english;
  return OVERLAYS[locale]?.sections[key] ?? english;
}
