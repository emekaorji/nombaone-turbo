"use client";

import { useEffect, useState } from "react";

import {
  buildSnippets,
  LANG_LABEL,
  SNIPPET_LANGS,
  type SnippetLang,
} from "@/lib/snippets";

/**
 * `<Snippet>` (Phase 03) — a language switcher over the buffet snippet engine.
 * Give it a method, path, and optional body; it renders the request in cURL,
 * Node, Python, and Go, generated from one source so the languages can't drift.
 * The chosen language is remembered across the site in `localStorage`.
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
  const [lang, setLang] = useState<SnippetLang>(defaultLang ?? "curl");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // A pinned default wins; otherwise restore the reader's remembered choice.
    if (defaultLang) return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as SnippetLang | null;
    if (saved && SNIPPET_LANGS.includes(saved)) setLang(saved);
  }, [defaultLang]);

  function pick(next: SnippetLang) {
    setLang(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const snippets = buildSnippets({ method, path, body, idempotent });
  const code = snippets[lang];

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border">
      <div role="tablist" aria-label="Language" className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-2">
        {SNIPPET_LANGS.map((l) => {
          const selected = l === lang;
          return (
            <button
              key={l}
              role="tab"
              aria-selected={selected}
              onClick={() => pick(l)}
              className={
                "px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
                (selected
                  ? "border-b-2 border-[--accent] text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {LANG_LABEL[l]}
            </button>
          );
        })}
        <button
          type="button"
          onClick={copy}
          className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-[--accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[--code-bg] px-4 py-3.5 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}
