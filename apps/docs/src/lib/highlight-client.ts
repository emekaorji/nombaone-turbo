"use client";

import { getSingletonHighlighter } from "shiki";

import { nombaoneDark, nombaoneLight } from "./shiki-theme";

/**
 * Client-side Shiki for code that is GENERATED at runtime (the `<Snippet>`
 * language switcher, interactive labs) — the fenced ```blocks are highlighted at
 * build time by `rehype-pretty-code`, but runtime code has no build pass.
 *
 * This produces markup byte-compatible with the build-time output so the SAME
 * global CSS styles it: dual themes emit each token span with `--shiki-light` /
 * `--shiki-dark` CSS vars, and we tag the `<code>` with `data-theme` so the docs'
 * `pre code[data-theme] span` rule binds `color` to the active theme var (flipping
 * under `[data-theme="dark"]`). Same themes as `lib/mdx-pipeline.ts`, so a snippet
 * and a fenced block are visually identical.
 */

/** `<Snippet>`/SDK language → the Shiki grammar that highlights it. */
const SHIKI_LANG: Record<string, string> = {
  curl: "bash",
  node: "typescript",
  javascript: "javascript",
  typescript: "typescript",
  ts: "typescript",
  python: "python",
  go: "go",
  php: "php",
  ruby: "ruby",
  java: "java",
  rust: "rust",
  dotnet: "csharp",
  csharp: "csharp",
  elixir: "elixir",
  json: "json",
  bash: "bash",
};

const LANGS = [...new Set(Object.values(SHIKI_LANG))];

let highlighterPromise: ReturnType<typeof getSingletonHighlighter> | null = null;
function highlighter() {
  highlighterPromise ??= getSingletonHighlighter({
    themes: [nombaoneLight, nombaoneDark],
    langs: LANGS,
  });
  return highlighterPromise;
}

/**
 * Highlight `code` and return the HTML that goes INSIDE a `<code>` element — the
 * per-line `<span class="line">…</span>` markup. The caller renders it as
 * `<code data-theme="dual" dangerouslySetInnerHTML={{ __html }} />` inside the
 * shared code shell, so the docs' `pre code[data-theme] span` rule binds each
 * token's color to the active theme var. Falls back to `text` for unknown langs.
 */
export async function highlightSpans(code: string, lang: string): Promise<string> {
  const grammar = SHIKI_LANG[lang] ?? "text";
  const hl = await highlighter();
  const html = hl.codeToHtml(code, {
    lang: grammar,
    themes: { light: "nombaone-light", dark: "nombaone-dark" },
    defaultColor: false,
  });
  // Shiki wraps in `<pre class="shiki"><code>…</code></pre>`; keep only the inner
  // content of `<code>` (the highlighted line spans).
  const match = html.match(/<code[^>]*>([\s\S]*)<\/code>/);
  return match?.[1] ?? "";
}
