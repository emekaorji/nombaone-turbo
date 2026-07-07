import { evaluate } from "@mdx-js/mdx";
import { notFound } from "next/navigation";
import * as jsxRuntime from "react/jsx-runtime";

import { Breadcrumbs } from "@/components/chrome/breadcrumbs";
import { CopyPage } from "@/components/chrome/copy-page";
import { Pager } from "@/components/chrome/pager";
import { Toc } from "@/components/chrome/toc";
import { mdxComponents } from "@/components/mdx";
import { ReferenceArticle } from "@/components/reference/reference-article";
import { apiRefMeta, apiRefSlugs, resolveApiRef } from "@/lib/api-ref/routing";
import { getPage, listRoutableSlugs } from "@/lib/content";
import { mdxOptions } from "@/lib/mdx-pipeline";

import type { Metadata } from "next";

/**
 * The catch-all docs route. Resolves the URL slug → `.mdx` file (content
 * layer), compiles the body with `@mdx-js/mdx`'s `evaluate` through our shared
 * plugin set + component kit, and renders it inside the bespoke content
 * column with breadcrumbs, an on-this-page TOC (scroll-spy), and a prev/next
 * pager.
 *
 * `[[...slug]]` is an *optional* catch-all so `/` (home → `content/index.mdx`)
 * and every nested path resolve through one route.
 */

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/** Normalize the optional catch-all segments to our slug form (`''` | `/a/b`). */
function toSlug(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  return `/${segments.join("/")}`;
}

/** Prerender every authored page at build time. */
export async function generateStaticParams(): Promise<{ slug?: string[] }[]> {
  const slugs = await listRoutableSlugs();
  const all = [...new Set([...slugs, ...apiRefSlugs()])];
  return all.map((slug) => ({
    slug: slug === "" ? [] : slug.replace(/^\//, "").split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = toSlug(slug);
  const apiMatch = resolveApiRef(path);
  if (apiMatch) {
    const { title, description } = apiRefMeta(apiMatch);
    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: { type: "article", title, description, url: path },
      twitter: { card: "summary_large_image", title, description },
    };
  }
  const page = await getPage(path);
  if (!page) return {};
  const { title, description } = page.frontmatter;
  const canonical = path === "" ? "/" : path;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: path === "" ? "website" : "article", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const resolvedSlug = toSlug(slug);

  // Spec-driven API reference (`/reference`, `/reference/<resource>`,
  // `/reference/<resource>/<operation>`) renders from the OpenAPI model; every
  // other path is an authored MDX page.
  const apiMatch = resolveApiRef(resolvedSlug);
  if (apiMatch) {
    return (
      <div className="flex w-full">
        <ReferenceArticle match={apiMatch} />
      </div>
    );
  }

  const page = await getPage(resolvedSlug);

  if (!page) notFound();

  const isHome = resolvedSlug === "";

  // Render MDX with @mdx-js/mdx's `evaluate` (NOT next-mdx-remote, whose v6
  // silently drops JSX *expression* attributes like `legs={[…]}`, passing only
  // string attrs). `evaluate` is the canonical renderer and supports the full
  // component-prop surface our signature components rely on.
  const { default: MDXContent } = await evaluate(page.body, {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    baseUrl: import.meta.url,
    ...mdxOptions,
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
              <Breadcrumbs slug={resolvedSlug} title={page.frontmatter.title} />
            ) : (
              <span />
            )}
            <CopyPage slug={resolvedSlug} />
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

          <div className="docs-prose">
            <MDXContent components={mdxComponents} />
          </div>

          <Pager slug={resolvedSlug} />
        </article>
      </main>

      {/* Right TOC rail (complementary). */}
      {showToc && (
        <aside
          aria-label="On this page"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto px-4 py-8 xl:block"
        >
          <Toc headings={page.headings} />
        </aside>
      )}
    </div>
  );
}
