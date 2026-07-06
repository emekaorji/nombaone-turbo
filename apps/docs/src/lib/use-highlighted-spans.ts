"use client";

import { useEffect, useState } from "react";

import { highlightSpans } from "./highlight-client";

/**
 * Highlight runtime-generated `code` and return the inner-`<code>` span HTML, or
 * `null` until it resolves — render the plain code as a fallback meanwhile.
 *
 * The resolved HTML is tagged with the `(code, lang)` it was computed for and
 * compared during render, so a stale highlight is never shown after the inputs
 * change. This deliberately avoids a synchronous `setState` reset in the effect
 * body (which Next 16's `react-hooks/set-state-in-effect` rule forbids): the
 * only `setState` runs inside the async `.then`, and the reset is derived.
 */
export function useHighlightedSpans(code: string, lang: string): string | null {
  const [result, setResult] = useState<{ code: string; lang: string; html: string } | null>(null);

  useEffect(() => {
    let alive = true;
    highlightSpans(code, lang)
      .then((html) => {
        if (alive) setResult({ code, lang, html });
      })
      .catch(() => {
        // Keep the plain fallback if the client highlighter fails.
      });
    return () => {
      alive = false;
    };
  }, [code, lang]);

  return result && result.code === code && result.lang === lang ? result.html : null;
}
