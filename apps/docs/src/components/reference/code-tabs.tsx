"use client";

import { useState } from "react";

import { CopyButton } from "@/components/mdx/copy-button";
import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-client-value";
import { useHighlightedSpans } from "@/lib/use-highlighted-spans";

/**
 * The language switcher for a reference operation's code samples: a tab per
 * language (cURL + the nine SDKs), each Shiki-highlighted client-side with the
 * same themes as the fenced blocks. The chosen language is remembered site-wide
 * in `localStorage`, so a reader who picks Go once sees Go on every operation.
 */

const STORAGE_KEY = "nbo-api-lang";

export interface CodeSample {
  lang: string;
  label: string;
  /** Shiki grammar id. */
  grammar: string;
  code: string;
}

export function CodeTabs({ samples }: { samples: CodeSample[] }) {
  // The reader's explicit pick wins; before any pick we restore the site-wide
  // remembered language (read only after mount, so SSR and first client render
  // agree — never setState in an effect, per the Next-16 lint rule).
  const mounted = useMounted();
  const [picked, setPicked] = useState<string | null>(null);
  const remembered = mounted && !picked ? window.localStorage.getItem(STORAGE_KEY) : null;
  const activeLang =
    picked ?? (remembered && samples.some((s) => s.lang === remembered) ? remembered : samples[0]?.lang);
  const active = Math.max(0, samples.findIndex((s) => s.lang === activeLang));

  function pick(i: number) {
    setPicked(samples[i]!.lang);
    window.localStorage.setItem(STORAGE_KEY, samples[i]!.lang);
  }

  const current = samples[active] ?? samples[0];
  if (!current) return null;

  return (
    <figure className="group not-prose my-6 overflow-hidden rounded-lg border border-border bg-code-bg text-[14px] shadow-sm">
      <figcaption className="flex items-center gap-2 border-b border-border/70 bg-code-titlebar-bg pl-1 pr-2">
        <div
          role="tablist"
          aria-label="Language"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none"
        >
          {samples.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.lang}
                role="tab"
                aria-selected={selected}
                onClick={() => pick(i)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selected
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <CopyButton value={current.code} className="shrink-0" />
      </figcaption>
      <Highlighted code={current.code} grammar={current.grammar} />
    </figure>
  );
}

function Highlighted({ code, grammar }: { code: string; grammar: string }) {
  const spans = useHighlightedSpans(code, grammar);
  return (
    <pre className="overflow-x-auto px-4 py-4 font-mono leading-relaxed [&>code]:grid [&>code]:bg-transparent">
      {spans ? (
        <code data-theme="dual" dangerouslySetInnerHTML={{ __html: spans }} />
      ) : (
        <code className="text-foreground">{code}</code>
      )}
    </pre>
  );
}
