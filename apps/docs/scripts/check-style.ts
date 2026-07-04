/**
 * Prose-style gate (launch gate; a Vale replacement that needs no binary). Scans
 * MDX prose — outside fenced code blocks — for a small set of UNAMBIGUOUS house-
 * style violations, so the locked vocabulary and quality bar can't quietly rot.
 *
 * Conservative on purpose: it only fails on things that are always wrong, so it
 * never fights a legitimate sentence. "tenant" is a warning (the multi-tenancy
 * essays use it correctly), not a failure.
 *
 * Run with `pnpm -F @nombaone/docs check:style`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

interface Rule {
  re: RegExp;
  message: string;
  level: "error" | "warn";
}

const RULES: Rule[] = [
  { re: /\bkobos\b/gi, message: '"kobos" — kobo is invariant; write "kobo"', level: "error" },
  { re: /\b(TODO|FIXME|XXX)\b/g, message: "leftover TODO/FIXME/XXX marker in published prose", level: "error" },
  { re: /\[(click here|here|read more|link)\]\(/gi, message: 'non-descriptive link text (a11y) — name the destination', level: "error" },
  { re: /\bteh\b/g, message: 'likely typo "teh"', level: "error" },
  { re: /\brecieve\b/gi, message: 'likely typo "recieve" → "receive"', level: "error" },
  { re: /\btenants?\b/gi, message: '"tenant" — prefer "organization" for API-surface language', level: "warn" },
];

/** Strip fenced code blocks + inline code so rules only see prose. */
function proseOnly(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]+>/g, ""); // drop JSX tags too
}

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
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const rel = path.relative(CONTENT_DIR, file);
    const { content } = matter(await fs.readFile(file, "utf8"));
    const prose = proseOnly(content);

    for (const rule of RULES) {
      const matches = prose.match(rule.re);
      if (matches) {
        const line = `${rel}: ${rule.message} (${matches.length}×)`;
        (rule.level === "error" ? errors : warnings).push(line);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n[check-style] ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn("  ⚠ " + w);
  }

  if (errors.length > 0) {
    console.error(`\n[check-style] ${errors.length} style error(s):`);
    for (const e of errors) console.error("  ✗ " + e);
    console.error("");
    process.exit(1);
  }

  console.log(`[check-style] OK — ${files.length} pages, prose clean${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
}

main().catch((err) => {
  console.error("[check-style] failed:", err);
  process.exit(1);
});
