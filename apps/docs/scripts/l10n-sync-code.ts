/**
 * Copy the English code fences into every translation, verbatim.
 *
 * This is the cheap half of keeping translations current, and it is the half that
 * happens most often. When someone edits a curl sample or a JSON body, the prose
 * around it usually does not change at all — only the code does. Code is never
 * translated, so that edit needs no translator, no model, and no review: the new
 * fence is simply copied across. Run this and the translations are current again.
 *
 * It also repairs the one thing a machine translator reliably gets wrong. Told to
 * translate a page, a model will quietly "tidy" a code sample — collapse a JSON
 * body onto one line, drop a field it thinks is redundant — which silently changes
 * what the example DOES. `scripts/check-l10n.ts` fails the build on that; this
 * fixes it, by restoring the only version that is authoritative.
 *
 * Positional, which is safe because `check-l10n` enforces an equal fence count.
 * A file whose count does NOT match is left alone and reported: that is a real
 * structural divergence and a human should look at it.
 *
 * Run: `pnpm -F @nombaone/docs l10n:sync-code`
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { TRANSLATED_LOCALES } from "../src/lib/l10n/config";

const CONTENT_DIR = path.join(process.cwd(), "content");
const L10N_DIR = path.join(process.cwd(), "l10n");

const FENCE = /```[\s\S]*?```/g;

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

async function main() {
  let repaired = 0;
  let skipped = 0;
  let clean = 0;

  for (const locale of TRANSLATED_LOCALES) {
    const root = path.join(L10N_DIR, locale);

    for (const file of await listMdx(root)) {
      const rel = path.relative(root, file);
      const englishFile = path.join(CONTENT_DIR, rel);

      let english: string;
      try {
        english = await fs.readFile(englishFile, "utf8");
      } catch {
        continue; // orphan translation — check-l10n reports it
      }

      const translated = await fs.readFile(file, "utf8");
      const englishFences = english.match(FENCE) ?? [];
      const localeFences = translated.match(FENCE) ?? [];

      if (englishFences.length !== localeFences.length) {
        console.warn(
          `  ⚠ ${locale}/${rel}: ${localeFences.length} fence(s) vs ${englishFences.length} in English — structural divergence, not auto-fixable`,
        );
        skipped += 1;
        continue;
      }

      let index = 0;
      const next = translated.replace(FENCE, () => englishFences[index++]);

      if (next === translated) {
        clean += 1;
        continue;
      }

      const changed = englishFences.filter((f, i) => f !== localeFences[i]).length;
      await fs.writeFile(file, next, "utf8");
      console.log(`  ✓ ${locale}/${rel}: ${changed} fence(s) restored from English`);
      repaired += 1;
    }
  }

  console.log(
    `[l10n:sync-code] ${repaired} file(s) repaired, ${clean} already current` +
      (skipped ? `, ${skipped} need a human` : ""),
  );
}

main().catch((error) => {
  console.error("[l10n:sync-code] failed:", error);
  process.exit(1);
});
