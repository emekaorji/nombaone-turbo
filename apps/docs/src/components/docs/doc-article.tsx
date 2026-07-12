import { evaluate } from "@mdx-js/mdx";
import * as jsxRuntime from "react/jsx-runtime";

import { Breadcrumbs } from "@/components/chrome/breadcrumbs";
import { CopyPage } from "@/components/chrome/copy-page";
import { Pager } from "@/components/chrome/pager";
import { Toc } from "@/components/chrome/toc";
import { TranslationNotice } from "@/components/docs/translation-notice";
import { mdxComponents } from "@/components/mdx";
import { t } from "@/lib/l10n/t";
import { mdxOptions, mdxOptionsForLocale } from "@/lib/mdx-pipeline";

import type { DocPage } from "@/lib/content";

/**
 * The rendered body of a docs page — shared verbatim by the English route and
 * the locale routes, so a translated page is laid out identically to its source
 * and there is exactly one copy of this markup to keep true.
 */
export async function DocArticle({ page }: { page: DocPage }) {
  const isHome = page.slug === "";

  // Render MDX with @mdx-js/mdx's `evaluate` (NOT next-mdx-remote, whose v6
  // silently drops JSX *expression* attributes like `legs={[…]}`, passing only
  // string attrs). `evaluate` is the canonical renderer and supports the full
  // component-prop surface our signature components rely on.
  const { default: MDXContent } = await evaluate(page.body, {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    baseUrl: import.meta.url,
    // A translated page renders its headings with the ENGLISH ids, so a deep link
    // written against the canonical slug resolves in every locale.
    ...(page.anchorIds ? mdxOptionsForLocale(page.anchorIds) : mdxOptions),
  });

  // TOC rail: shown on nested pages that have h2/h3 headings, unless the page
  // opts out with `toc: false` in frontmatter (home + landing suppress it).
  const showToc = !isHome && page.frontmatter.toc !== false && page.headings.length > 0;

  return (
    <div className="flex w-full">
      {/* Content column — the `main` landmark + skip-link target. */}
      <main
        id="content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-5 py-8 outline-none lg:px-10 xl:px-12"
      >
        <article className="mx-auto w-full max-w-(--doc-shell-max)">
          <div className="mb-2 flex items-center justify-between gap-3">
            {!isHome ? (
              <Breadcrumbs slug={page.slug} title={page.frontmatter.title} locale={page.locale} />
            ) : (
              <span />
            )}
            <CopyPage slug={page.slug} />
          </div>

          <header className="mb-2">
            <h1 className="text-[32px] font-bold leading-[40px] tracking-tight text-foreground">
              {page.frontmatter.title}
            </h1>
            {page.frontmatter.description && (
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                {page.frontmatter.description}
              </p>
            )}
          </header>

          {/* Renders nothing on English. */}
          <div className="mt-6">
            <TranslationNotice locale={page.locale} slug={page.slug} />
          </div>

          <div className="docs-prose">
            <MDXContent components={mdxComponents} />
          </div>

          <Pager slug={page.slug} locale={page.locale} />
        </article>
      </main>

      {/* Right TOC rail (complementary). */}
      {showToc && (
        <aside
          aria-label={t("toc.onThisPage", page.locale)}
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto px-4 py-8 xl:block"
        >
          <Toc headings={page.headings} />
        </aside>
      )}
    </div>
  );
}
