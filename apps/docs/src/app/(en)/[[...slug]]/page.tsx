import { notFound } from "next/navigation";

import { DocArticle } from "@/components/docs/doc-article";
import { ReferenceArticle } from "@/components/reference/reference-article";
import { apiRefMeta, apiRefSlugs, resolveApiRef } from "@/lib/api-ref/routing";
import { getPage, listRoutableSlugs } from "@/lib/content";

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

  return <DocArticle page={page} />;
}
