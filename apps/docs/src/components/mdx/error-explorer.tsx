"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ERROR_CODE_META, PUBLIC_ERROR_CODES } from "@nombaone/errors";

/**
 * `<ErrorExplorer>` (Phase 04) — paste an error response, get the fix. The
 * reader drops in a full `{ success:false, error:{ code } }` envelope (or just a
 * code); this extracts the code, looks it up in the registry, and shows the hint
 * plus a deep link to its `/errors` entry. Grounded in `ERROR_CODE_META` — it
 * only resolves codes the API actually emits, never a guess. Pure client leaf.
 */

const META = ERROR_CODE_META as Record<string, { hint?: string; docUrl?: string }>;
const PUBLIC = new Set<string>(PUBLIC_ERROR_CODES as ReadonlySet<string>);

const SAMPLE = `{
  "success": false,
  "statusCode": 401,
  "error": { "code": "API_KEY_INVALID", "message": "Invalid or missing API key." },
  "meta": { "requestId": "req_4f9c2a7e1b0d8c3a5e6f10a2" }
}`;

/** Pull the first known error code out of arbitrary pasted text. */
function extractCode(input: string): string | null {
  // Prefer a "code": "X" field; else the first ALL_CAPS token that's a code.
  const field = input.match(/"code"\s*:\s*"([A-Z0-9_]+)"/);
  if (field && META[field[1]]) return field[1];
  const tokens = input.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? [];
  for (const t of tokens) if (META[t]) return t;
  return null;
}

export function ErrorExplorer() {
  const [text, setText] = useState(SAMPLE);
  const code = useMemo(() => extractCode(text), [text]);
  const meta = code ? META[code] : null;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Error explorer
        </p>
      </div>

      <div className="p-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="err-input">
          Paste an error response (or just a code)
        </label>
        <textarea
          id="err-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-border bg-[--code-bg] px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="mt-3" role="status" aria-live="polite">
          {code && meta ? (
            <div className="rounded-lg border border-[--accent]/30 bg-[--accent]/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-[--code-bg] px-2 py-0.5 font-mono text-sm font-semibold text-[--accent]">
                  {code}
                </code>
                {!PUBLIC.has(code) && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">internal</span>
                )}
              </div>
              {meta.hint && <p className="mt-2 text-sm leading-relaxed text-foreground">{meta.hint}</p>}
              <Link
                href={`/errors#${code}`}
                className="mt-2 inline-block text-sm font-medium text-[--accent] hover:underline"
              >
                Open in the error reference →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No known error code found in that text. Paste the full response, or check the{" "}
              <Link href="/errors" className="text-[--accent] hover:underline">error reference</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
