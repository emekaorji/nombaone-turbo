import { promises as fs } from "node:fs";
import path from "node:path";

import GithubSlugger, { slug as githubSlug } from "github-slugger";
import matter from "gray-matter";

import { DEFAULT_LOCALE, type Locale } from "@/lib/l10n/config";
import { ALL_SLUGS, findNavItem, findSection, type Badge } from "@content/manifest";

/**
 * Typed content layer. Walks `content/`, resolves slug ↔ file, parses
 * frontmatter, and extracts the heading tree (for the TOC + breadcrumbs +
 * prev/next). Server-only: it reads from disk via `node:fs`.
 *
 * The catch-all route resolves a URL slug to a file here, compiles the body
 * with `@mdx-js/mdx`'s `evaluate`, and hands the heading tree to the TOC rail.
 *
 * LOCALES: every entry point takes an optional trailing `locale`, defaulting to
 * English — so every existing call site keeps its exact current behaviour. A
 * locale resolves against `l10n/<locale>/` instead of `content/`; English never
 * moves. Nothing about a page's identity changes with locale: the slug, the
 * heading ids, and the manifest position are all shared, and only the prose
 * differs.
 */

/** Absolute path to the `content/` directory at the app root. */
export const CONTENT_DIR = path.join(process.cwd(), "content");

/** Absolute path to the translations tree, a SIBLING of `content/`. */
export const L10N_DIR = path.join(process.cwd(), "l10n");

/**
 * Where a locale's pages live. English is `content/`; a translation is
 * `l10n/<locale>/`, mirroring the English path exactly.
 */
export function localeDir(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? CONTENT_DIR : path.join(L10N_DIR, locale);
}

export interface Frontmatter {
  title: string;
  description?: string;
  /** Section key (mirrors the manifest); informational, manifest is canonical. */
  section?: string;
  /** Ordering hint within a section; manifest order is canonical. */
  order?: number;
  badge?: Badge;
  /** Set `false` to suppress the on-this-page TOC rail (default: shown when the page has h2/h3). */
  toc?: boolean;
}

export interface TocHeading {
  /** The heading's real DOM id, minted by the same `github-slugger` as `rehype-slug`. */
  id: string;
  /** Visible heading text. */
  text: string;
  /** 2 or 3: we only surface h2/h3 in the rail. */
  depth: 2 | 3;
}

export interface DocPage {
  /** URL path, leading slash, no extension. `''` for home. */
  slug: string;
  /** The language this body is written in. */
  locale: Locale;
  /** Absolute path to the resolved `.mdx` file. */
  filePath: string;
  frontmatter: Frontmatter;
  /** Raw MDX body (frontmatter stripped). */
  body: string;
  /** Ordered h2/h3 headings for the on-this-page rail. */
  headings: TocHeading[];
  /**
   * On a TRANSLATED page: the ENGLISH heading ids, in order — handed to
   * `rehypeLocaleAnchor` so the rendered headings carry language-neutral
   * fragments. Undefined on English, which owns its own ids.
   */
  anchorIds?: string[];
}

/**
 * Slug → file path, within a locale. Home (`''`) maps to `index.mdx`; every
 * other slug maps to `<slug>.mdx`. Returns `null` if the file does not exist —
 * which, for a translated locale, is the ordinary "not translated yet" case.
 */
export async function resolveSlugToFile(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<string | null> {
  const rel = slug === "" ? "index" : slug.replace(/^\//, "");
  const filePath = path.join(localeDir(locale), `${rel}.mdx`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Extract the on-this-page heading tree from raw MDX. We parse ATX headings
 * (`## `, `### `) line by line and slugify the text with `github-slugger` —
 * the very package `rehype-slug` uses to mint the real DOM ids — so the TOC
 * anchor and the heading it points at are guaranteed to agree, including on
 * non-ASCII headings. Fenced code blocks are skipped so `# comments` inside
 * snippets never leak into the TOC.
 *
 * A fresh `GithubSlugger` per document reproduces rehype-slug's dedup exactly
 * (two "Request" headings → `request`, `request-1`), because rehype-slug also
 * instantiates one slugger per file.
 */
export function extractHeadings(body: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const slugger = new GithubSlugger();
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
    headings.push({ id: slugger.slug(text), text, depth });
  }

  return headings;
}

/**
 * Stateless slug, identical to what `rehype-slug` mints for a heading. Use
 * `extractHeadings` when you need per-document dedup; this is for one-off ids.
 */
export function slugify(text: string): string {
  return githubSlug(text);
}

/**
 * A "coming soon" stub for a manifest-listed route whose `.mdx` is not yet
 * authored — so the full IA is navigable and nothing 404s while content lands.
 * The owning phase replaces the stub by adding `content/<slug>.mdx`.
 */
function buildStubPage(slug: string): DocPage {
  const navItem = findNavItem(slug);
  const title = navItem?.title ?? humanizeSlug(slug);
  const summary = navItem?.summary;
  const body = [
    `<Callout type="note" title="Coming soon">`,
    summary
      ? `  ${summary} This page is planned and on the way.`
      : `  This page is planned and on the way.`,
    ``,
    `  In the meantime, start with the **[Quickstart](/getting-started/quickstart)**,`,
    `  or browse the rest of the docs from the sidebar.`,
    `</Callout>`,
    ``,
  ].join("\n");

  return {
    slug,
    locale: DEFAULT_LOCALE,
    filePath: "",
    frontmatter: { title, description: summary, section: findSection(slug)?.key, toc: false },
    body,
    headings: [],
  };
}

/**
 * Load + parse a single page by slug, in a locale.
 *
 * English: a manifest route without an authored `.mdx` renders a stub (not a
 * 404); an unknown slug returns `null` (real 404).
 *
 * A translated locale NEVER renders a stub. If the translation is absent this
 * returns `null` and the route 308s to the English page — which is a better
 * answer than a "coming soon" card in a language we haven't written yet, and it
 * makes partial translation a valid production state from day one.
 */
export async function getPage(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DocPage | null> {
  const filePath = await resolveSlugToFile(slug, locale);
  if (!filePath) {
    if (locale !== DEFAULT_LOCALE) return null;
    return ALL_SLUGS.includes(slug) ? buildStubPage(slug) : null;
  }

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
    toc: typeof data.toc === "boolean" ? data.toc : undefined,
  };

  const headings = extractHeadings(content);

  // A translated page borrows the ENGLISH heading ids. Links are authored against
  // the canonical English slug — `/concepts/the-ledger#idempotency-lives-here-too`
  // — and the renderer only prefixes the PATH, never the fragment. If the Yorùbá
  // page minted `#ìdí-tí-èyí-fi-ṣe-pàtàkì` from its own text, every deep link into
  // it would silently land at the top of the page. So the fragment stays
  // language-neutral and the visible text is what changes.
  //
  // The TOC gets the same ids, or it would link to anchors the DOM does not have.
  let anchorIds: string[] | undefined;
  if (locale !== DEFAULT_LOCALE) {
    const englishPath = await resolveSlugToFile(slug, DEFAULT_LOCALE);
    if (englishPath) {
      const english = matter(await fs.readFile(englishPath, "utf8")).content;
      anchorIds = extractHeadings(english).map((h) => h.id);
      for (const [index, heading] of headings.entries()) {
        const id = anchorIds[index];
        if (id) heading.id = id;
      }
    }
  }

  return {
    slug,
    locale,
    filePath,
    frontmatter,
    body: content,
    headings,
    anchorIds,
  };
}

/**
 * Walk every `.mdx` in a locale's tree and return its slug. Used by the
 * search-index builder and `generateStaticParams`. `index.mdx` → `''`.
 *
 * A translated locale's tree may not exist yet — that is not an error, it is an
 * empty locale, so we return `[]` rather than throwing during a build.
 */
export async function listAllSlugs(locale: Locale = DEFAULT_LOCALE): Promise<string[]> {
  const root = localeDir(locale);
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

      const rel = path.relative(root, full).replace(/\.mdx$/, "");
      slugs.push(rel === "index" ? "" : `/${rel}`);
    }
  }

  try {
    await walk(root);
  } catch {
    return [];
  }
  return slugs;
}

/**
 * The slugs a translated locale actually covers — authored translations only.
 *
 * Deliberately NOT unioned with `ALL_SLUGS`: the manifest is the English IA, and
 * a locale is only ever as complete as the files that exist for it. This is what
 * `generateStaticParams` prerenders and what `href()` consults to decide whether
 * to link into the locale or straight back to English.
 */
export async function listTranslatedSlugs(locale: Locale): Promise<string[]> {
  if (locale === DEFAULT_LOCALE) return [];
  return listAllSlugs(locale);
}

/**
 * Every routable slug = authored `.mdx` pages ∪ manifest routes (which render a
 * stub until authored). Used by `generateStaticParams` so the whole IA
 * prerenders and no manifest link 404s. The search-index builder uses
 * `listAllSlugs` (authored only) so stubs never pollute search.
 */
export async function listRoutableSlugs(): Promise<string[]> {
  const authored = await listAllSlugs();
  return Array.from(new Set([...authored, ...ALL_SLUGS]));
}

/** "/concepts/balances-and-ledger" → "Balances And Ledger". */
function humanizeSlug(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? "Home";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBadge(value: unknown): value is Badge {
  return value === "new" || value === "beta" || value === "updated";
}
