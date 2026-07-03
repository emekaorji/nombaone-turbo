import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import {
  GROUP_LABELS,
  GROUP_ORDER,
  type HardPartFrontmatter,
  type HardPartGroup,
} from "@content/hard-parts/frontmatter";

const DIR = path.join(process.cwd(), "content", "hard-parts");

export interface Article {
  slug: string;
  frontmatter: HardPartFrontmatter;
  body: string;
}

/** YAML auto-parses bare dates into Date objects; coerce them back to strings. */
function normalizeFrontmatter(data: Record<string, unknown>): HardPartFrontmatter {
  const fm = { ...data } as Record<string, unknown>;
  const updated = fm.updated;
  if (updated instanceof Date) {
    fm.updated = updated.toISOString().slice(0, 10);
  } else if (updated != null) {
    fm.updated = String(updated);
  }
  return fm as unknown as HardPartFrontmatter;
}

export function getAllArticles(): Article[] {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      const { data, content } = matter(raw);
      const fm = normalizeFrontmatter(data);
      return { slug: fm.slug ?? file.replace(/\.mdx$/, ""), frontmatter: fm, body: content };
    })
    .sort((a, b) => a.frontmatter.title.localeCompare(b.frontmatter.title));
}

export function getArticle(slug: string): Article | null {
  const file = path.join(DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return { slug, frontmatter: normalizeFrontmatter(data), body: content };
}

export function getArticlesByGroup(): {
  group: HardPartGroup;
  label: string;
  articles: Article[];
}[] {
  const all = getAllArticles();
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    articles: all.filter((a) => a.frontmatter.group === group),
  })).filter((g) => g.articles.length > 0);
}

export function listAllSlugs(): string[] {
  return getAllArticles().map((a) => a.slug);
}
