import {
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  OG_LOCALES,
  TRANSLATED_LOCALES,
  withLocale,
  type Locale,
} from './config';

import type { Metadata, Viewport } from 'next';

/**
 * Root metadata, per locale.
 *
 * `baseMetadata('en')` returns exactly the object the root layout used to hold —
 * same keys, same values, same order — so the English `<head>` does not move a
 * byte. The translated locales differ only in `og:locale`, the canonical, and
 * (once the dictionaries land) the site title and description.
 */

const SITE_URL = 'https://docs.nombaone.xyz';

/**
 * Site-level copy per locale.
 *
 * These sit under the same do-not-translate policy as the pages (`l10n/dnt.json`):
 * `developer`, `plan`, `subscription`, `webhook`, `kobo` and friends are the
 * names of things in the API, not English words, so they stay English in every
 * locale. A Yorùbá reader still types `subscription` into their code. Inventing
 * vocabulary here would only produce terms no Nigerian developer has ever seen.
 *
 * Machine-drafted, then run through `scripts/check-l10n.ts` for orthography
 * (NFC, subdots + tone for `yo`; ɓ/ɗ/ƙ and `ʼ` = U+02BC for `ha`).
 */
const SITE_COPY: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Nomba One: Developer Docs',
    description:
      'Developer documentation for Nomba One, a subscription-billing engine on Nomba (Nigerian payments): plans, cycles, proration, dunning, and settlement over card, direct debit, bank transfer, and crypto. Integer-kobo money on a double-entry ledger.',
  },
  yo: {
    title: 'Nomba One: Àkọsílẹ̀ fún Developer',
    description:
      'Àkọsílẹ̀ Nomba One — ẹ̀rọ subscription billing lórí Nomba (ìsanwó Nàìjíríà): plan, cycle, proration, dunning, àti settlement lórí card, direct debit, bank transfer, àti crypto. Owó jẹ́ kobo lódidi lórí ledger onípele-méjì.',
  },
  ha: {
    title: 'Nomba One: Takardar Developer',
    description:
      'Takardar Nomba One — injin subscription billing a kan Nomba (biyan kuɗi na Najeriya): plan, cycle, proration, dunning, da settlement ta card, direct debit, bank transfer, da crypto. Kuɗi kobo ne cikakke a kan ledger mai shigarwa biyu.',
  },
};

/** hreflang for the site root. Per-page alternates are emitted by the page. */
function rootLanguages(): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of TRANSLATED_LOCALES) {
    languages[LOCALE_TAGS[locale]] = withLocale('', locale);
  }
  languages['x-default'] = '/';
  return languages;
}

export function baseMetadata(locale: Locale): Metadata {
  const { title, description } = SITE_COPY[locale];
  const canonical = withLocale('', locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: '%s - Nomba One Docs',
    },
    description,
    applicationName: 'Nomba One Docs',
    keywords: [
      'Nomba One',
      'Nomba API',
      'developer documentation',
      'subscription billing',
      'recurring billing Nigeria',
      'dunning',
      'proration',
      'double-entry ledger',
      'direct debit',
      'bank transfer',
      'webhooks',
      'REST API',
    ],
    authors: [{ name: 'Nomba One' }],
    creator: 'Nomba One',
    publisher: 'Nomba One',
    alternates: {
      canonical,
      ...(locale === DEFAULT_LOCALE ? { languages: rootLanguages() } : {}),
    },
    openGraph: {
      type: 'website',
      locale: OG_LOCALES[locale],
      url: `${SITE_URL}${canonical === '/' ? '' : canonical}`,
      siteName: 'Nomba One Docs',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@nomba',
      site: '@nomba',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    appleWebApp: {
      capable: true,
      title: 'Nomba One Docs',
      statusBarStyle: 'black-translucent',
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
    { media: '(prefers-color-scheme: dark)', color: '#040404' },
  ],
};
