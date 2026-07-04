/**
 * Frontmatter validator (launch gate). Every content page must carry a `title`
 * and a `description` (the summary agents and search read), and its `section`,
 * if present, must be a real manifest section key. A page missing either, or
 * pointing at a section that doesn't exist, fails the build — so the typed
 * frontmatter contract the `.md` mirror + `llms.txt` depend on can never rot.
 *
 * Run with `pnpm -F @nombaone/docs check:frontmatter`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { MANIFEST } from "../content/manifest";

const CONTENT_DIR = path.join(process.cwd(), "content");
const SECTION_KEYS = new Set(MANIFEST.map((s) => s.key));

async function listMdx(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMdx(full)));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

async function main() {
  const files = await listMdx(CONTENT_DIR);
  const problems: string[] = [];

  for (const file of files) {
    const rel = path.relative(CONTENT_DIR, file);
    const { data } = matter(await fs.readFile(file, "utf8"));

    const title = data.title;
    const description = data.description;
    const section = data.section;

    if (typeof title !== "string" || title.trim() === "") {
      problems.push(`${rel}: missing 'title'`);
    }
    if (typeof description !== "string" || description.trim() === "") {
      problems.push(`${rel}: missing 'description' (agents + search read this)`);
    } else if (description.length > 320) {
      problems.push(`${rel}: 'description' is ${description.length} chars (keep ≤ 320, one sentence)`);
    }
    if (section !== undefined && !SECTION_KEYS.has(String(section))) {
      problems.push(`${rel}: 'section: ${section}' is not a manifest section key`);
    }
  }

  if (problems.length > 0) {
    console.error(`\n[check-frontmatter] ${problems.length} problem(s):`);
    for (const p of problems) console.error("  ✗ " + p);
    console.error("");
    process.exit(1);
  }

  console.log(`[check-frontmatter] OK — ${files.length} pages, all have typed title + description`);
}

main().catch((err) => {
  console.error("[check-frontmatter] failed:", err);
  process.exit(1);
});
