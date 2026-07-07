import { notFound } from "next/navigation";
import Link from "next/link";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";

import { GROUP_LABELS } from "@content/hard-parts/frontmatter";
import { Container } from "@/components/layout/Container";
import { mdxComponents } from "@/components/mdx";
import { CTABand } from "@/components/sections/CTABand";
import { getAllArticles, getArticle, listAllSlugs } from "@/lib/content";
import { mdxOptions } from "@/lib/mdx-pipeline";

const APP_URL = "https://console.nombaone.xyz";

export function generateStaticParams() {
  return listAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Guide" };
  const { title, problem, updated } = article.frontmatter;
  return {
    title,
    description: problem,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: {
      type: "article",
      title,
      description: problem,
      url: `/guides/${slug}`,
      modifiedTime: updated,
    },
    twitter: { card: "summary_large_image", title, description: problem },
  };
}

function formatMonthYear(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const fm = article.frontmatter;
  const groupLabel = GROUP_LABELS[fm.group] ?? fm.group;

  const { default: MDXContent } = await evaluate(article.body, {
    ...runtime,
    ...mdxOptions,
  });

  const related = getAllArticles()
    .filter((a) => a.frontmatter.group === fm.group && a.slug !== slug)
    .slice(0, 2);

  return (
    <>
      <div className="mx-auto max-w-[760px] px-5 pt-20 md:pt-[120px]">
        {/* Header */}
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-muted px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-[13px] font-medium text-accent">{groupLabel}</span>
        </span>
        <h1 className="mt-5 text-[32px] font-semibold leading-[1.08] tracking-[-1.2px] text-foreground md:text-[46px] md:tracking-[-1.8px]">
          {fm.title}
        </h1>
        <p className="mt-[18px] text-lg leading-[1.5] text-muted-foreground md:text-[21px]">
          {fm.problem}
        </p>
        <p className="mt-4 font-mono text-[12.5px] text-subtle-foreground">
          {fm.readingTime} min read&nbsp;&nbsp;·&nbsp;&nbsp;Updated {formatMonthYear(fm.updated)}
        </p>

        {/* Body — MDX beats */}
        <div className="article-beats mt-12">
          <MDXContent components={mdxComponents} />
        </div>

        {/* Related */}
        {related.length > 0 ? (
          <div className="mt-14 border-t border-border pt-7">
            <span className="font-mono text-[12.5px] tracking-[0.5px] text-subtle-foreground">
              Related
            </span>
            <div className="mt-4 flex flex-col gap-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/${r.slug}`}
                  className="text-[15px] text-foreground transition-colors hover:text-accent"
                >
                  {r.frontmatter.title} →
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* CTA */}
      <Container className="pb-20 md:pb-[120px] pt-16 md:pt-[100px]">
        <CTABand
          title="Start with a request, not a sales call."
          primary={{ label: "Get an API key", href: APP_URL }}
          secondary={{ label: "Read the quickstart", href: "/guides" }}
          npm="npm i @nombaone/node"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </Container>
    </>
  );
}
