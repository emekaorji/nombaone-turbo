import { DEFAULT_LOCALE, isNeverTranslated, withLocale, type Locale } from "./config";

/**
 * The entire link story, in one function.
 *
 * Translators write CANONICAL ENGLISH hrefs inside `l10n/**` — `/concepts/the-ledger`,
 * never `/yo/concepts/the-ledger`. The renderer adds the prefix. Two things fall
 * out of that, and both are the reason it works this way:
 *
 *   1. `check-links.ts` validates the `l10n/` tree with zero modification, because
 *      the hrefs it finds there are the same slugs it already knows about.
 *   2. A translator can never author a broken locale link, because they never
 *      author a locale link at all.
 *
 * `coverage` is the set of slugs actually translated for the active locale. A link
 * to an untranslated page points straight at English rather than at a locale URL
 * that would only 308 there anyway — one less hop, and no flash of a redirect.
 */
export function href(slug: string, locale: Locale, coverage: readonly string[]): string {
  const canonical = slug === "" ? "/" : slug;

  // English is the identity case. Provably zero change to every existing link.
  if (locale === DEFAULT_LOCALE) return canonical;

  // External, anchor-only, or already-prefixed hrefs pass through untouched.
  if (!slug.startsWith("/")) return slug;

  // Frozen-in-English pages (the API reference, the SDKs, the error registry)
  // link to their English selves from any locale.
  if (isNeverTranslated(slug)) return canonical;

  if (!coverage.includes(slug)) return canonical;

  return withLocale(slug, locale);
}
