"use client";

import { useHighlightedSpans } from "@/lib/use-highlighted-spans";

import { CodeShell } from "./code-shell";

import type { ReactNode } from "react";

/**
 * A runtime-highlighted code block that renders through the shared `<CodeShell>`,
 * so any interactive widget (the API explorer's response + snippets, the
 * quickstart, labs) shows code identical to a fenced ```block — same surface,
 * same bar/copy, same Shiki themes. The code is highlighted client-side because
 * it's generated at render time; a plain fallback shows until the colors load.
 */
export function HighlightedCode({
  code,
  lang,
  bar,
  barClassName,
  preClassName,
}: {
  code: string;
  /** A `SHIKI_LANG` key: curl | node | typescript | python | go | php | ruby | json | bash. */
  lang: string;
  bar?: ReactNode;
  barClassName?: string;
  preClassName?: string;
}) {
  const spans = useHighlightedSpans(code, lang);

  return (
    <CodeShell bar={bar} barClassName={barClassName} copyValue={code} preClassName={preClassName}>
      {spans ? (
        <code data-theme="dual" dangerouslySetInnerHTML={{ __html: spans }} />
      ) : (
        <code className="text-foreground">{code}</code>
      )}
    </CodeShell>
  );
}
