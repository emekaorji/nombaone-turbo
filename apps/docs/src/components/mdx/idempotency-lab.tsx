"use client";

import { useState } from "react";

/**
 * `<IdempotencyLab>` (Phase 07) — an in-browser illustration of the
 * idempotency-key contract: the same key returns the same result, a new key
 * creates a new one. It is transparently client-side (it keeps a local map of
 * seen keys) and clearly labelled as an illustration of the rule, NOT a live API
 * call — so it teaches the contract without pretending to hit the sandbox.
 */

interface Attempt {
  n: number;
  key: string;
  outcome: "created" | "replayed";
  resourceId: string;
}

/** Deterministic pseudo-id from a key, so replays show the SAME id. */
function idFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `nbo${h.toString(36).padStart(9, "0").slice(0, 9)}sub`;
}

export function IdempotencyLab() {
  const [key, setKey] = useState("a1b2c3-key");
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [log, setLog] = useState<Attempt[]>([]);

  function send() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setSeen((prevSeen) => {
      const existing = prevSeen[trimmed];
      const resourceId = existing ?? idFor(trimmed);
      setLog((prevLog) => [
        {
          n: prevLog.length + 1,
          key: trimmed,
          outcome: existing ? "replayed" : "created",
          resourceId,
        },
        ...prevLog,
      ]);
      return existing ? prevSeen : { ...prevSeen, [trimmed]: resourceId };
    });
  }

  function reset() {
    setSeen({});
    setLog([]);
  }

  const createdCount = new Set(log.filter((a) => a.outcome === "created").map((a) => a.resourceId)).size;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Idempotency lab · illustration
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Idempotency-Key
          </span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Idempotency key"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={send}
          className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground,#04120c)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          POST /v1/subscriptions
        </button>
      </div>

      <p className="px-4 pb-2 text-xs text-muted-foreground">
        Send twice with the same key → one subscription. Change the key → a new one.{" "}
        <strong className="text-foreground">{createdCount}</strong> created across{" "}
        <strong className="text-foreground">{log.length}</strong> request
        {log.length === 1 ? "" : "s"}.
      </p>

      {log.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-y-auto border-t border-border p-3">
          {log.map((a) => (
            <li
              key={a.n}
              className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">#{a.n}</span>
              <code className="font-mono text-foreground">{a.key}</code>
              <span
                className={
                  a.outcome === "created"
                    ? "rounded bg-[--accent]/15 px-1.5 py-0.5 font-semibold text-[--accent]"
                    : "rounded bg-amber-400/15 px-1.5 py-0.5 font-semibold text-amber-400"
                }
              >
                {a.outcome === "created" ? "201 created" : "200 replayed"}
              </span>
              <code className="ml-auto font-mono text-muted-foreground">{a.resourceId}</code>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Runs in your browser to show the rule. In the API, idempotency is enforced against the
        ledger, so a replay resolves to exactly one posting, never a second charge.
      </p>
    </div>
  );
}
