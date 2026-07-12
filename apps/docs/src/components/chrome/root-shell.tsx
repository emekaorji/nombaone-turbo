import { Geist, Geist_Mono, Inter } from 'next/font/google';

import { AskAI } from '@/components/chrome/ask-ai';
import { SearchProvider } from '@/components/chrome/search-provider';
import { SidebarNav } from '@/components/chrome/sidebar-nav';
import { ThemeProvider } from '@/components/chrome/theme-provider';
import { Topbar } from '@/components/chrome/topbar';
import { JsonLd } from '@/components/json-ld';
import { listTranslatedSlugs } from '@/lib/content';
import { LOCALE_TAGS, type Locale } from '@/lib/l10n/config';
import { L10nProvider } from '@/lib/l10n/context';
import { t } from '@/lib/l10n/t';

import '@/app/globals.css';

/**
 * The one document shell, shared by every root layout.
 *
 * Next needs a root layout per route group, and we have three (`(en)`, `(yo)`,
 * `(ha)`) because the locale is a STATIC path segment rather than a dynamic
 * `[locale]` one — see `src/app/(yo)/layout.tsx` for why that matters. Rather
 * than triplicate the document, each layout is a five-line wrapper around this.
 *
 * English renders byte-for-byte what it rendered before this file existed.
 */

/**
 * Geist gains `latin-ext` for a reason that has nothing to do with i18n: `₦`
 * (U+20A6) lives in that subset, so on `subsets: ['latin']` the naira sign we
 * print all over the money copy was being served by the reader's OS font.
 */
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
});

/**
 * The face that can actually spell Yorùbá and Hausa.
 *
 * Geist's glyph table has NONE of ɓ ɗ ƙ Ɓ Ɗ Ƙ and no ṣ/Ṣ — verified against the
 * cmap of both Google's build and Vercel's own `geist` package. And while it
 * does carry ẹ/ọ, those live in Google's `vietnamese` subset, which `next/font`
 * does not publish for Geist. No `subsets` setting can fix either gap: you
 * cannot request a glyph that was never drawn.
 *
 * Inter has all twelve letters, the combining tone marks, correct mark/mkmk
 * anchoring, and `₦` — and it is the closest visual relative to Geist. It sits
 * BEHIND Geist in `--font-sans` (globals.css), so an English page never reaches
 * it: Geist covers every glyph English needs. On `/yo` and `/ha` it takes the
 * whole page, so a translated word is never set in two typefaces at once.
 */
const intlSans = Inter({
  variable: '--font-intl',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
});

export async function RootShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // Which slugs this locale actually covers, read straight off disk on every
  // render — so it cannot drift from the files the way a generated manifest
  // would. It is what `href()` consults to decide whether a link points into the
  // locale or straight back to English. Empty for English, which covers all.
  const coverage = await listTranslatedSlugs(locale);

  return (
    <html
      lang={LOCALE_TAGS[locale]}
      data-locale={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${intlSans.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <JsonLd locale={locale} />
        <a
          href="#content"
          className="sr-only rounded-md focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-md"
        >
          {t('chrome.skipToContent', locale)}
        </a>
        <L10nProvider locale={locale} coverage={coverage}>
          <ThemeProvider>
            <SearchProvider>
              <Topbar locale={locale} />
              <div className="mx-auto flex w-full max-w-[100rem]">
                {/* Desktop sidebar rail, sticky under the topbar. */}
                <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border lg:block">
                  <SidebarNav />
                </aside>
                <div className="min-w-0 flex-1">{children}</div>
              </div>
              <AskAI />
            </SearchProvider>
          </ThemeProvider>
        </L10nProvider>
      </body>
    </html>
  );
}
