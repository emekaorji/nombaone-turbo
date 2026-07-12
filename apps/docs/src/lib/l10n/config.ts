/**
 * Locale configuration — the one place that knows which languages exist and
 * which pages they are allowed to cover.
 *
 * English is authoritative. A translated page is a cache of the English one,
 * never a gate on it: if a translation is missing, stale, or withdrawn, the
 * route 308s to English and the reader still gets the truth.
 *
 * NOTE ON NAMING: this codebase already uses `lang` for two other things —
 * `SNIPPET_LANGS` (programming languages) and `<SdkMethodIndex lang="node">`
 * (an SDK id). The locale concept is called `locale` everywhere, never `lang`.
 */

/** The authoring language. Every page exists in English; only some are translated. */
export const DEFAULT_LOCALE = "en" as const;

/** Locales we serve translations for, in switcher order. */
export const TRANSLATED_LOCALES = ["yo", "ha"] as const;

export const LOCALES = [DEFAULT_LOCALE, ...TRANSLATED_LOCALES] as const;

export type Locale = (typeof LOCALES)[number];
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isTranslatedLocale(value: string): value is TranslatedLocale {
  return (TRANSLATED_LOCALES as readonly string[]).includes(value);
}

/** Human names, in the language itself — a switcher that says "Yoruba" in English is a tell. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  yo: "Yorùbá",
  ha: "Hausa",
};

/** BCP-47 tags for `<html lang>`, `hreflang`, and `og:locale`. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  yo: "yo-NG",
  ha: "ha-NG",
};

export const OG_LOCALES: Record<Locale, string> = {
  en: "en_NG",
  yo: "yo_NG",
  ha: "ha_NG",
};

// --- what may be translated --------------------------------------------------

/**
 * Whole subtrees that are never translated (the slug itself and everything
 * under it).
 *
 * `/reference` is 89 pages assembled from the OpenAPI snapshot — its titles AND
 * its URL segments come out of the same function (`crudSlugTitle()`), so you
 * cannot localize the words without breaking the links. `/sdks` is 44% of all
 * prose in the docs and almost entirely code. `/sandbox-toolkit` is a rehearsal
 * harness for engineers.
 */
const NEVER_TRANSLATED_SUBTREES = ["/reference", "/sdks", "/sandbox-toolkit"] as const;

/**
 * Individual pages that are never translated.
 *
 * `/errors` and `/webhooks/event-catalog` are the load-bearing ones: they render
 * live data out of `@nombaone/errors` and `@nombaone/core-contracts` — the exact
 * strings the API returns in `error.hint` and serves from `GET /v1/events/catalog`.
 * Translating them would make the API's error contract locale-dependent; forking
 * them for the docs would make the docs disagree with the API. Neither is
 * acceptable, so they stay English by written policy.
 */
const NEVER_TRANSLATED_PAGES = [
  "/errors",
  "/changelog",
  "/cookbook",
  "/agents",
  "/webhooks/event-catalog",
  "/webhooks/simulate",
] as const;

/**
 * Subtrees whose CHILDREN are never translated but whose root is. The quickstart
 * hub is prose worth translating; the seven per-language quickstarts under it are
 * code with captions.
 */
const NEVER_TRANSLATED_CHILDREN = ["/getting-started/quickstart"] as const;

/**
 * Is this page frozen in English? A locale route for such a slug 308s to the
 * English path, and `check-l10n` fails if a translation file exists for one.
 */
export function isNeverTranslated(slug: string): boolean {
  if ((NEVER_TRANSLATED_PAGES as readonly string[]).includes(slug)) return true;
  for (const root of NEVER_TRANSLATED_SUBTREES) {
    if (slug === root || slug.startsWith(`${root}/`)) return true;
  }
  for (const root of NEVER_TRANSLATED_CHILDREN) {
    if (slug.startsWith(`${root}/`)) return true;
  }
  return false;
}

/**
 * May this page be translated? Derived, not enumerated — so a new page under
 * `concepts/` becomes translatable the moment it is authored, instead of
 * silently falling out of a hand-maintained list.
 */
export function isTranslatable(slug: string): boolean {
  return !isNeverTranslated(slug);
}

/**
 * The frozen-in-English routes, as `next.config.ts` redirect sources.
 *
 * Generated from the lists above rather than retyped, so a page added to
 * `NEVER_TRANSLATED_PAGES` cannot be left routable under `/yo` by accident.
 * Every source is locale-prefixed, so no English URL can match one of these.
 */
export function neverTranslatedRedirects(): { source: string; destination: string }[] {
  const localeMatcher = `:locale(${TRANSLATED_LOCALES.join("|")})`;
  const rules: { source: string; destination: string }[] = [];

  for (const root of [...NEVER_TRANSLATED_SUBTREES, ...NEVER_TRANSLATED_CHILDREN]) {
    rules.push({ source: `/${localeMatcher}${root}/:path*`, destination: `${root}/:path*` });
  }
  // Subtree roots themselves (`/yo/reference` → `/reference`); the children-only
  // roots are deliberately absent here, since those roots ARE translatable.
  for (const root of NEVER_TRANSLATED_SUBTREES) {
    rules.push({ source: `/${localeMatcher}${root}`, destination: root });
  }
  for (const page of NEVER_TRANSLATED_PAGES) {
    rules.push({ source: `/${localeMatcher}${page}`, destination: page });
  }

  return rules;
}

/** `/concepts/the-ledger` + `yo` → `/yo/concepts/the-ledger`. Home → `/yo`. */
export function withLocale(slug: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return slug === "" ? "/" : slug;
  return slug === "" ? `/${locale}` : `/${locale}${slug}`;
}

/** `/yo/concepts/the-ledger` → `{ locale: 'yo', slug: '/concepts/the-ledger' }`. */
export function stripLocale(path: string): { locale: Locale; slug: string } {
  const match = /^\/([a-z]{2})(?=\/|$)/.exec(path);
  const candidate = match?.[1];
  if (!candidate || !isTranslatedLocale(candidate)) {
    return { locale: DEFAULT_LOCALE, slug: path === "/" ? "" : path };
  }
  const rest = path.slice(candidate.length + 1);
  return { locale: candidate, slug: rest === "/" || rest === "" ? "" : rest };
}
