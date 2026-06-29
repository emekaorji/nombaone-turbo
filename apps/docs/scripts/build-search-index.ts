/**
 * Build-time search indexer. Walks every `.mdx` under `content/`, parses
 * frontmatter, splits the body by h2 headings, strips MDX/markdown to plain
 * text, and writes one record per page + per section to
 * `public/search-index.json`. Wired into `pnpm build` (see package.json
 * `search:index` → runs before `next build`).
 *
 * Run standalone with `pnpm -F @nombaone/docs search:index`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { MANIFEST, findNavItem, findSection } from "../content/manifest";

import type { SearchDoc } from "../src/lib/search-types";

const CONTENT_DIR = path.join(process.cwd(), "content");
const OUTPUT = path.join(process.cwd(), "public", "search-index.json");

/** Collect every `.mdx` file (absolute paths). */
async function listMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMdxFiles(full)));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

/** file path → url slug (`/x/y`), `index.mdx` → `''`. */
function fileToSlug(file: string): string {
  const rel = path.relative(CONTENT_DIR, file).replace(/\.mdx$/, "");
  return rel === "index" ? "" : `/${rel}`;
}

/** github-slugger-compatible (matches rehype-slug + the content layer). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Reduce MDX/markdown to readable plain text for full-text matching: drop code
 * fences, JSX tags, import/export lines, link syntax, and inline markers.
 */
function toPlainText(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/^import .*$/gm, " ")
    .replace(/^export .*$/gm, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ") // JSX/HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function build() {
  const files = await listMdxFiles(CONTENT_DIR);
  const docs: SearchDoc[] = [];

  for (const file of files) {
    const slug = fileToSlug(file);
    const raw = await fs.readFile(file, "utf8");
    const { content, data } = matter(raw);

    const navItem = findNavItem(slug);
    const section = findSection(slug);
    const sectionLabel =
      section?.title ?? (slug === "" ? "Home" : "Docs");
    const title =
      (typeof data.title === "string" ? data.title : undefined) ??
      navItem?.title ??
      slug ??
      "Home";
    const description =
      typeof data.description === "string" ? data.description : "";
    const url = slug === "" ? "/" : slug;

    // Page-level record.
    docs.push({
      id: url,
      title,
      section: sectionLabel,
      heading: "",
      text: toPlainText(`${description} ${content}`).slice(0, 600),
      url,
    });

    // Section-level records — split body on h2 boundaries.
    const lines = content.split("\n");
    let currentHeading: string | null = null;
    let buffer: string[] = [];
    let inFence = false;

    const flush = () => {
      if (currentHeading) {
        const id = slugify(currentHeading);
        docs.push({
          id: `${url}#${id}`,
          title,
          section: sectionLabel,
          heading: currentHeading,
          text: toPlainText(buffer.join("\n")).slice(0, 400),
          url: `${url === "/" ? "" : url}#${id}`,
        });
      }
      buffer = [];
    };

    for (const line of lines) {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const h2 = !inFence ? /^##\s+(.+?)\s*#*$/.exec(line) : null;
      if (h2) {
        flush();
        currentHeading = h2[1].replace(/[*_`]/g, "").trim();
      } else {
        buffer.push(line);
      }
    }
    flush();
  }

  // Stable order: manifest order, page records before their sections.
  const sectionRank = new Map<string, number>(
    MANIFEST.map((s, i) => [s.title, i]),
  );
  docs.sort((a, b) => {
    const ra = sectionRank.get(a.section) ?? -1;
    const rb = sectionRank.get(b.section) ?? -1;
    if (ra !== rb) return ra - rb;
    if (a.url !== b.url) return a.url.localeCompare(b.url);
    return a.heading.length - b.heading.length;
  });

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(docs), "utf8");
  console.log(`[search] indexed ${docs.length} records → public/search-index.json`);
}

build().catch((error) => {
  console.error("[search] index build failed:", error);
  process.exit(1);
});
