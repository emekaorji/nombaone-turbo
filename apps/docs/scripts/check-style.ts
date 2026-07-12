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
const L10N_DIR = path.join(process.cwd(), "l10n");

interface Rule {
  re: RegExp;
  message: string;
  level: "error" | "warn";
  /** `en` = English prose only. `all` = every language. */
  scope: "en" | "all";
}

/**
 * WORD BOUNDARIES AND NON-ASCII TEXT — read before editing a rule.
 *
 * JS `\b` is defined against `IsWordChar` = `[A-Za-z0-9_]`, ASCII only. Every
 * Yorùbá and Hausa diacritic is therefore a NON-word character, which means `\b`
 * manufactures a word boundary in the middle of a word. Concretely:
 *
 *     /\bteh\b/.test("ọ̀tehìn")    → true      ← the build dies on correct Yorùbá
 *     /\bkobos\b/i.test("kobosí")  → true
 *
 * Adding the `/u` flag does NOT fix this — `u` does not change `\b`'s ASCII
 * `IsWordChar`. The fix is an explicit Unicode boundary: a lookaround asserting
 * the neighbour is not a letter, a combining mark, or a digit in ANY script.
 */
const B0 = String.raw`(?<![\p{L}\p{M}\p{N}_])`;
const B1 = String.raw`(?![\p{L}\p{M}\p{N}_])`;

const RULES: Rule[] = [
  // `kobo` is a do-not-translate term, invariant in every language — so this one
  // is worth enforcing everywhere. With the Unicode boundary, `kobosí` no longer
  // false-fires.
  {
    re: new RegExp(`${B0}kobos${B1}`, "giu"),
    message: '"kobos" — kobo is invariant; write "kobo"',
    level: "error",
    scope: "all",
  },
  // Locale-neutral, and MORE valuable on translations than on English: it is how
  // a half-finished machine-drafted page gets caught.
  {
    re: new RegExp(`${B0}(TODO|FIXME|XXX)${B1}`, "gu"),
    message: "leftover TODO/FIXME/XXX marker in published prose",
    level: "error",
    scope: "all",
  },
  // The a11y intent is universal but the vocabulary is English, so on a Yorùbá
  // page this is a no-op — `[tẹ ibí](…)` sails through. Scoping it to `en` states
  // that gap rather than pretending to coverage we do not have.
  {
    re: /\[(click here|here|read more|link)\]\(/gi,
    message: "non-descriptive link text (a11y) — name the destination",
    level: "error",
    scope: "en",
  },
  // English typos. A Yorùbá page has no business being linted for them, and with
  // the ASCII `\b` they actively false-failed the deploy.
  { re: new RegExp(`${B0}teh${B1}`, "gu"), message: 'likely typo "teh"', level: "error", scope: "en" },
  {
    re: new RegExp(`${B0}recieve${B1}`, "giu"),
    message: 'likely typo "recieve" → "receive"',
    level: "error",
    scope: "en",
  },
  {
    re: new RegExp(`${B0}tenants?${B1}`, "giu"),
    message: '"tenant" — prefer "organization" for API-surface language',
    level: "warn",
    scope: "en",
  },
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
  const errors: string[] = [];
  const warnings: string[] = [];
  let checked = 0;

  // English prose gets every rule. Translations get only the locale-neutral ones
  // — `proseOnly()` (fences/inline-code/JSX stripped) is language-agnostic, so it
  // is reused as-is for both.
  const targets: { root: string; scope: "en" | "all" }[] = [
    { root: CONTENT_DIR, scope: "en" },
    { root: L10N_DIR, scope: "all" },
  ];

  for (const target of targets) {
    let files: string[];
    try {
      files = await listMdx(target.root);
    } catch {
      continue; // no translations yet — not an error
    }

    for (const file of files) {
      checked += 1;
      const rel = path.relative(process.cwd(), file);
      const { content } = matter(await fs.readFile(file, "utf8"));
      const prose = proseOnly(content);

      for (const rule of RULES) {
        // On a translation, run only the rules that mean something in any language.
        if (target.scope === "all" && rule.scope === "en") continue;

        const matches = prose.match(rule.re);
        if (matches) {
          const line = `${rel}: ${rule.message} (${matches.length}×)`;
          (rule.level === "error" ? errors : warnings).push(line);
        }
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

  console.log(`[check-style] OK — ${checked} pages, prose clean${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
}

main().catch((err) => {
  console.error("[check-style] failed:", err);
  process.exit(1);
});
