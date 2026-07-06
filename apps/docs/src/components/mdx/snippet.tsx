"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import {
  buildSnippets,
  LANG_LABEL,
  SNIPPET_LANGS,
  type SnippetLang,
} from "@/lib/snippets";
import { useMounted } from "@/lib/use-client-value";
import { useHighlightedSpans } from "@/lib/use-highlighted-spans";

import { CodeShell } from "./code-shell";

/**
 * `<Snippet>` (Phase 03) — a language switcher over the buffet snippet engine.
 * Give it a method, path, and optional body; it renders the request in cURL,
 * Node, Python, Go, PHP, and Ruby, generated from one source so the languages
 * can't drift. The chosen language is remembered across the site in `localStorage`.
 *
 * Renders through the shared `<CodeShell>`, so it is visually identical to a fenced
 * ```block — the only difference is the header holds language tabs. Highlighting is
 * client-side (the code is generated at runtime) with the SAME Shiki themes as the
 * build-time blocks.
 *
 *   <Snippet method="POST" path="/v1/plans" body={{ name: "Pro" }} idempotent />
 */

const STORAGE_KEY = "nbo-snippet-lang";

interface SnippetProps {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  idempotent?: boolean;
  /** Pin the initial language (e.g. a per-stack page). Falls back to the
   * site-wide remembered choice, then cURL. */
  defaultLang?: SnippetLang;
}

export function Snippet({ method, path, body, idempotent, defaultLang }: SnippetProps) {
  const mounted = useMounted();
  // The reader's explicit click wins; before any click we fall back to a pinned
  // default, then the site-wide remembered choice, then cURL. The remembered
  // choice is read only after mount (via `useMounted`, a `useSyncExternalStore`
  // read) so SSR and the first client render agree — never `setState` in an
  // effect, per the Next-16 `react-hooks/set-state-in-effect` rule.
  const [selected, setSelected] = useState<SnippetLang | null>(null);
  const remembered =
    mounted && !defaultLang
      ? (window.localStorage.getItem(STORAGE_KEY) as SnippetLang | null)
      : null;
  const lang: SnippetLang =
    selected ??
    defaultLang ??
    (remembered && SNIPPET_LANGS.includes(remembered) ? remembered : "curl");

  function pick(next: SnippetLang) {
    setSelected(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const snippets = buildSnippets({ method, path, body, idempotent });
  const code = snippets[lang];
  const spans = useHighlightedSpans(code, lang);

  const tabs = (
    <div role="tablist" aria-label="Language" className="flex items-center gap-0.5">
      {SNIPPET_LANGS.map((l) => {
        const selected = l === lang;
        return (
          <button
            key={l}
            role="tab"
            aria-selected={selected}
            onClick={() => pick(l)}
            className={cn(
              "px-3 py-2 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              selected
                ? "border-b-2 border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LANG_LABEL[l]}
          </button>
        );
      })}
    </div>
  );

  return (
    <CodeShell bar={tabs} barClassName="px-2 py-0" className="my-6" copyValue={code}>
      {spans ? (
        <code data-theme="dual" dangerouslySetInnerHTML={{ __html: spans }} />
      ) : (
        // Un-highlighted fallback while the client highlighter loads — same
        // geometry so there is no layout shift when the colors arrive.
        <code className="text-foreground">{code}</code>
      )}
    </CodeShell>
  );
}
