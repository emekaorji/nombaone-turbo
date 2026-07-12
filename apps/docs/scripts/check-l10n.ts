/**
 * The l10n gate.
 *
 * READ THIS BEFORE ADDING A HARD FAILURE HERE. There is no docs CI — the only
 * workflow (`.github/workflows/deploy-api.yml`) explicitly excludes `apps/docs/`,
 * so every check in `package.json`'s `build` chain runs on the DEPLOY. A gate
 * that exits non-zero does not fail a pull request; it fails production.
 *
 * So the rule is: things a TRANSLATOR can get wrong are hard errors (they are
 * caught before the translation is committed, and they are always fixable by
 * fixing the translation). Things an ENGLISH EDIT can make true — chiefly
 * staleness — are warnings that DEMOTE the page, never failures. If someone
 * edits an English paragraph on a Tuesday, the Yorùbá page quietly falls back to
 * English; the site does not stop shipping.
 *
 * That asymmetry is the whole design. Translation is a cache of English, never a
 * gate on it.
 *
 * Run standalone: `pnpm -F @nombaone/docs check:l10n`
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import {
  TRANSLATED_LOCALES,
  isNeverTranslated,
  type TranslatedLocale,
} from "../src/lib/l10n/config";
import { ALL_SLUGS } from "../content/manifest";

const CONTENT_DIR = path.join(process.cwd(), "content");
const L10N_DIR = path.join(process.cwd(), "l10n");

const errors: string[] = [];
const warnings: string[] = [];

// --- orthography -------------------------------------------------------------

/**
 * The `ʼ` in Hausa (`ʼyanci`, `ʼyan kasuwa`) is U+02BC MODIFIER LETTER
 * APOSTROPHE — a LETTER. The typewriter `'` (U+0027) and the curly `’` (U+2019)
 * are PUNCTUATION, so they split the word in two for any tokenizer that respects
 * Unicode: `ʼyan` stays one token, `'yan` becomes `yan`, which is a different,
 * real Hausa word. Search breaks and the text is wrong.
 */
const HAUSA_BAD_APOSTROPHE = /[A-Za-zɓɗƙ][''’][A-Za-zɓɗƙ]/;

/** `ƴ` is Niger orthography. Nigerian Hausa writes `ʼy`. */
const NIGER_HOOKED_Y = /[ƴƳ]/;

/**
 * Standard Nigerian Hausa is written WITHOUT tone or vowel-length marks. Their
 * presence means the drafter has confused it with Yorùbá.
 *
 * It must match BOTH forms. Every file here is NFC-normalized, so a tone-marked
 * vowel arrives PRECOMPOSED (`à` = U+00E0) — a regex that only looks for the
 * combining marks (U+0300/0301/0304) would therefore never fire on the very text
 * it is meant to police.
 */
const TONE_MARKS = /[̀́̄à-åè-ëì-ïò-öù-üÀ-ÅÈ-ÏÒ-ÖÙ-Üāēīōū]/;

/** Yorùbá subdot vowels/consonants — the language is not written without them. */
const YORUBA_SUBDOTS = /[ẹọṣẸỌṢ]/;

interface PageCheck {
  locale: TranslatedLocale;
  slug: string;
  file: string;
  raw: string;
  body: string;
  data: Record<string, unknown>;
}

async function listMdx(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await listMdx(full)));
      else if (entry.name.endsWith(".mdx")) out.push(full);
    }
  } catch {
    return [];
  }
  return out;
}

/**
 * Orthography rules apply to PROSE, never to code.
 *
 * Code fences and inline code are copied byte-for-byte from the English source —
 * that is rule #1, and `checkAgainstEnglish` enforces it. So an English `'` inside
 * a curl comment (`# your endpoint's responses`) is not a Hausa glottal stop, it
 * is the code doing exactly what it is required to do. Linting it would demand the
 * translator corrupt a code sample to satisfy a spelling rule about a different
 * language.
 */
function proseOnly(mdx: string): string {
  return mdx.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
}

function checkOrthography(page: PageCheck) {
  const { locale, slug, raw } = page;
  const label = `${locale}${slug || "/"}`;
  const prose = proseOnly(page.body);

  // NFC applies to the WHOLE file, code included: composition skew breaks byte
  // comparison, heading ids, and search matching regardless of where it sits.
  if (raw.normalize("NFC") !== raw) {
    errors.push(`${label}: not NFC-normalized (run the drafter, which emits NFC)`);
  }

  if (locale === "ha") {
    if (HAUSA_BAD_APOSTROPHE.test(prose)) {
      errors.push(
        `${label}: uses ' (U+0027) or ’ (U+2019) as a glottal stop — Hausa needs ʼ (U+02BC), which is a letter, not punctuation`,
      );
    }
    if (NIGER_HOOKED_Y.test(prose)) {
      errors.push(`${label}: contains ƴ (U+01B4) — that is Niger orthography; Nigerian Hausa writes ʼy`);
    }
    if (TONE_MARKS.test(prose)) {
      errors.push(`${label}: contains tone marks — standard Nigerian Hausa is written untoned`);
    }
  }

  if (locale === "yo") {
    // Detects ABSENT diacritics. It cannot detect a WRONG tone — `ọkọ̀` (vehicle),
    // `ọkọ` (husband) and `ọ̀kọ̀` (spear) differ only in tone, so a wrong one is a
    // different valid word and passes every check here. Only a human catches that.
    // This is why every translated page carries the "English is authoritative" notice.
    if (!YORUBA_SUBDOTS.test(prose)) {
      errors.push(
        `${label}: no subdot letters (ẹ ọ ṣ) anywhere — Yorùbá is not written without them; the drafter has emitted undiacriticized text`,
      );
    }
  }
}

/** Every code fence and inline-code span must survive translation byte-for-byte. */
function fences(mdx: string): string[] {
  return [...mdx.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
}

function checkAgainstEnglish(page: PageCheck, english: string) {
  const label = `${page.locale}${page.slug || "/"}`;

  // Code is not prose. A drafter that "helpfully" localizes a curl command, a
  // field name, or an endpoint path has produced something worse than useless.
  const en = fences(english);
  const loc = fences(page.body);
  if (en.length !== loc.length) {
    errors.push(
      `${label}: has ${loc.length} code fence(s), English has ${en.length} — fences must be copied verbatim`,
    );
  } else {
    for (let i = 0; i < en.length; i += 1) {
      if (en[i] !== loc[i]) {
        errors.push(`${label}: code fence #${i + 1} differs from English — code is never translated`);
        break;
      }
    }
  }

  // Heading count parity. A dropped section is a silently incomplete page.
  const count = (s: string) => (s.match(/^#{2,3}\s/gm) ?? []).length;
  if (count(english) !== count(page.body)) {
    warnings.push(
      `${label}: ${count(page.body)} heading(s) vs ${count(english)} in English — a section may have been dropped or invented`,
    );
  }
}

async function main() {
  const translatable = new Set(ALL_SLUGS.filter((slug) => !isNeverTranslated(slug)));

  for (const locale of TRANSLATED_LOCALES) {
    const root = path.join(L10N_DIR, locale);
    const files = await listMdx(root);

    for (const file of files) {
      const rel = path.relative(root, file).replace(/\.mdx$/, "");
      const slug = rel === "index" ? "" : `/${rel}`;
      const raw = await fs.readFile(file, "utf8");
      const { content, data } = matter(raw);
      const page: PageCheck = { locale, slug, file, raw, body: content, data };

      // Scope enforcement. You cannot accidentally translate the API reference:
      // its titles and its URL segments come out of the same function, so a
      // translated one would be a page whose links do not work.
      if (isNeverTranslated(slug)) {
        errors.push(
          `${locale}${slug}: this page is frozen in English (see NEVER_TRANSLATED in src/lib/l10n/config.ts) — delete the translation; the route already 308s to English`,
        );
        continue;
      }

      // An orphan translation is a page nobody can reach: the locale route only
      // prerenders slugs that exist in English.
      const englishFile = path.join(CONTENT_DIR, `${rel}.mdx`);
      let english: string;
      try {
        english = matter(await fs.readFile(englishFile, "utf8")).content;
      } catch {
        errors.push(`${locale}${slug}: no English source at content/${rel}.mdx — orphan translation`);
        continue;
      }

      if (!translatable.has(slug) && slug !== "") {
        warnings.push(`${locale}${slug}: not in the manifest — the page will render but nothing links to it`);
      }

      if (typeof data.title !== "string" || data.title.trim() === "") {
        errors.push(`${locale}${slug}: missing frontmatter 'title'`);
      }

      checkOrthography(page);
      checkAgainstEnglish(page, english);
    }

    const covered = files.length;
    const total = translatable.size;
    console.log(
      `[check-l10n] ${locale}: ${covered}/${total} translatable pages (${
        total === 0 ? 0 : Math.round((covered / total) * 100)
      }%)`,
    );
  }

  for (const warning of warnings) console.warn(`  ⚠ ${warning}`);
  for (const error of errors) console.error(`  ✗ ${error}`);

  if (errors.length > 0) {
    console.error(
      `\n[check-l10n] ${errors.length} error(s). These are all translator-side and fixable by fixing the translation.`,
    );
    process.exit(1);
  }

  console.log(
    `[check-l10n] ok${warnings.length > 0 ? ` (${warnings.length} warning(s) — advisory, the build ships)` : ""}`,
  );
}

main().catch((error) => {
  console.error("[check-l10n] failed:", error);
  process.exit(1);
});
