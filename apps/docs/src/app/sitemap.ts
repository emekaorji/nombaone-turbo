import { apiRefSlugs } from '@/lib/api-ref/routing';
import { listRoutableSlugs, listTranslatedSlugs } from '@/lib/content';
import { LOCALE_TAGS, TRANSLATED_LOCALES, withLocale } from '@/lib/l10n/config';

import type { MetadataRoute } from 'next';

const BASE = 'https://docs.nombaone.xyz';

/**
 * The sitemap.
 *
 * Two fixes ride along with the locale work, both pre-existing gaps:
 *  - The 89 generated `/reference/**` routes were never listed at all. They are
 *    real, indexable pages; `apiRefSlugs()` is the same source the router uses.
 *  - There were no `hreflang` alternates.
 *
 * A locale alternate is emitted ONLY for a page that is genuinely translated.
 * Because an untranslated `/yo/*` URL 308s to English rather than serving an
 * English body under a Yorùbá URL, there is no duplicate content to declare and
 * every `hreflang` we emit is true.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const englishSlugs = Array.from(new Set([...(await listRoutableSlugs()), ...apiRefSlugs()]));
  const now = new Date();

  // slug → the locales that actually have it.
  const translated = new Map<string, string[]>();
  for (const locale of TRANSLATED_LOCALES) {
    for (const slug of await listTranslatedSlugs(locale)) {
      translated.set(slug, [...(translated.get(slug) ?? []), locale]);
    }
  }

  const entries: MetadataRoute.Sitemap = [];

  for (const slug of englishSlugs) {
    const locales = translated.get(slug) ?? [];
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[LOCALE_TAGS[locale as (typeof TRANSLATED_LOCALES)[number]]] =
        `${BASE}${withLocale(slug, locale as (typeof TRANSLATED_LOCALES)[number])}`;
    }

    entries.push({
      url: `${BASE}${slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: slug === '' ? 1 : 0.7,
      ...(locales.length > 0
        ? { alternates: { languages: { ...languages, en: `${BASE}${slug || '/'}` } } }
        : {}),
    });
  }

  // The translated pages themselves, each pointing back at the authoritative English.
  for (const [slug, locales] of translated) {
    for (const locale of locales) {
      const tag = locale as (typeof TRANSLATED_LOCALES)[number];
      entries.push({
        url: `${BASE}${withLocale(slug, tag)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
        alternates: {
          languages: {
            en: `${BASE}${slug || '/'}`,
            [LOCALE_TAGS[tag]]: `${BASE}${withLocale(slug, tag)}`,
          },
        },
      });
    }
  }

  return entries;
}
