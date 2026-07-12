import { permanentRedirect } from "next/navigation";

import { DocArticle } from "@/components/docs/doc-article";
import { getPage, listTranslatedSlugs } from "@/lib/content";
import { LOCALE_TAGS, OG_LOCALES, withLocale, type TranslatedLocale } from "@/lib/l10n/config";

import type { Metadata } from "next";

/**
 * The locale route, built once and instantiated per language.
 *
 * WHY A FACTORY AND NOT A `[locale]` SEGMENT — this is the load-bearing decision
 * in the whole routing design. Next's route sorter (`sorted-routes.ts`) ranks a
 * dynamic segment ABOVE an optional catch-all at the same level, and an
 * unconstrained `[locale]` matches ANY single segment — `concepts`, `guides`,
 * `reference`. So `/[locale]/[[...slug]]` would swallow `/concepts/the-ledger`
 * as `{ locale: "concepts", slug: ["the-ledger"] }`. Production hides this
 * (prerendered paths are served by exact match before dynamic matching); `next
 * dev` does not, and every English page breaks there. A prod/dev split-brain is
 * the worst failure mode a docs site can have.
 *
 * Static segments (`/yo/...`, `/ha/...`) sort BEFORE the catch-all, so English
 * is untouched and there is no ambiguity to resolve at all.
 */

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

function toSlug(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  return `/${segments.join("/")}`;
}

export function makeLocalePage(locale: TranslatedLocale) {
  /**
   * Prerender only what is actually translated. NOT unioned with the manifest:
   * a locale is exactly as complete as the files that exist for it.
   *
   * `dynamicParams` is deliberately left at its default (`true`). That is what
   * lets an untranslated `/yo/*` still reach the component below and 308 to
   * English, instead of 404ing.
   */
  async function generateStaticParams(): Promise<{ slug?: string[] }[]> {
    const slugs = await listTranslatedSlugs(locale);
    return slugs.map((slug) => ({
      slug: slug === "" ? [] : slug.replace(/^\//, "").split("/"),
    }));
  }

  async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const slug = toSlug((await params).slug);
    const page = await getPage(slug, locale);
    if (!page) return {};

    const { title, description } = page.frontmatter;
    const canonical = withLocale(slug, locale);
    const english = slug === "" ? "/" : slug;

    return {
      title,
      description,
      alternates: {
        canonical,
        // English is authoritative; say so to crawlers as well as to readers.
        languages: { en: english, [LOCALE_TAGS[locale]]: canonical, "x-default": english },
      },
      openGraph: {
        type: slug === "" ? "website" : "article",
        locale: OG_LOCALES[locale],
        title,
        description,
        url: canonical,
      },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  async function Page({ params }: PageProps) {
    const slug = toSlug((await params).slug);

    // Not translated (yet, or ever) → 308 to the English page. The reader lands
    // on the authoritative text rather than a "coming soon" card in a language
    // we have not written. `/yo/reference/*` and the other frozen trees never
    // get here — they are redirected at the edge by `next.config.ts`.
    const page = await getPage(slug, locale);
    if (!page) permanentRedirect(slug === "" ? "/" : slug);

    return <DocArticle page={page} />;
  }

  return { Page, generateStaticParams, generateMetadata };
}
