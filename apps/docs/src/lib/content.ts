import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { findNavItem, findSection, type Badge } from "@content/manifest";

/**
 * Typed content layer. Walks `content/`, resolves slug ↔ file, parses
 * frontmatter, and extracts the heading tree (for the TOC + breadcrumbs +
 * prev/next). Server-only: it reads from disk via `node:fs`.
 *
 * The catch-all route resolves a URL slug to a file here, compiles the body
 * with `@mdx-js/mdx`'s `evaluate`, and hands the heading tree to the TOC rail.
 */

/** Absolute path to the `content/` directory at the app root. */
export const CONTENT_DIR = path.join(process.cwd(), "content");

export interface Frontmatter {
  title: string;
  description?: string;
  /** Section key (mirrors the manifest); informational, manifest is canonical. */
  section?: string;
  /** Ordering hint within a section; manifest order is canonical. */
  order?: number;
  badge?: Badge;
}

export interface TocHeading {
  /** `rehype-slug`-compatible id (kebab, deduped is not needed at depth ≤ 3). */
  id: string;
  /** Visible heading text. */
  text: string;
  /** 2 or 3: we only surface h2/h3 in the rail. */
  depth: 2 | 3;
}

export interface DocPage {
  /** URL path, leading slash, no extension. `''` for home. */
  slug: string;
  /** Absolute path to the resolved `.mdx` file. */
  filePath: string;
  frontmatter: Frontmatter;
  /** Raw MDX body (frontmatter stripped). */
  body: string;
  /** Ordered h2/h3 headings for the on-this-page rail. */
  headings: TocHeading[];
}

/**
 * Slug → file path. Home (`''`) maps to `content/index.mdx`; every other slug
 * maps to `content/<slug>.mdx`. Returns `null` if the file does not exist.
 */
export async function resolveSlugToFile(slug: string): Promise<string | null> {
  const rel = slug === "" ? "index" : slug.replace(/^\//, "");
  const filePath = path.join(CONTENT_DIR, `${rel}.mdx`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Extract the on-this-page heading tree from raw MDX. We parse ATX headings
 * (`## `, `### `) line by line and slugify the text the same way `rehype-slug`
 * does (github-slugger semantics: lowercase, spaces→hyphens, strip
 * non-word/space/hyphen). Fenced code blocks are skipped so `# comments`
 * inside snippets never leak into the TOC.
 */
export function extractHeadings(body: string): TocHeading[] {
  const headings: TocHeading[] = [];
  // Dedup repeated slugs exactly like `rehype-slug`/github-slugger does on the
  // real heading ids (e.g. two "Request" headings → `request`, `request-1`), so
  // TOC keys stay unique AND the TOC anchors resolve to the right heading.
  const seen = new Map<string, number>();
  let inFence = false;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;

    const depth = match[1].length as 2 | 3;
    // Strip inline markdown (links, emphasis, inline code) to plain text.
    const text = match[2]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ id: count === 0 ? base : `${base}-${count}`, text, depth });
  }

  return headings;
}

/** github-slugger-compatible slug (matches `rehype-slug` output). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Load + parse a single page by slug. Returns `null` if no file exists. */
export async function getPage(slug: string): Promise<DocPage | null> {
  const filePath = await resolveSlugToFile(slug);
  if (!filePath) return null;

  const raw = await fs.readFile(filePath, "utf8");
  const { content, data } = matter(raw);

  // Title precedence: frontmatter → manifest label → humanized slug.
  const fmTitle = typeof data.title === "string" ? data.title : undefined;
  const navItem = findNavItem(slug);
  const title = fmTitle ?? navItem?.title ?? humanizeSlug(slug);

  const frontmatter: Frontmatter = {
    title,
    description: typeof data.description === "string" ? data.description : undefined,
    section: typeof data.section === "string" ? data.section : findSection(slug)?.key,
    order: typeof data.order === "number" ? data.order : undefined,
    badge: isBadge(data.badge) ? data.badge : navItem?.badge,
  };

  return {
    slug,
    filePath,
    frontmatter,
    body: content,
    headings: extractHeadings(content),
  };
}

/**
 * Walk every `.mdx` under `content/` and return its slug. Used by the
 * search-index builder and `generateStaticParams`. `index.mdx` → `''`.
 */
export async function listAllSlugs(): Promise<string[]> {
  const slugs: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".mdx")) continue;

      const rel = path.relative(CONTENT_DIR, full).replace(/\.mdx$/, "");
      slugs.push(rel === "index" ? "" : `/${rel}`);
    }
  }

  await walk(CONTENT_DIR);
  return slugs;
}

/** "/concepts/balances-and-ledger" → "Balances And Ledger". */
function humanizeSlug(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? "Home";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBadge(value: unknown): value is Badge {
  return value === "new" || value === "beta" || value === "updated";
}
