"use client";

import { useState } from "react";

import { KeyRound, Loader2, Play, ShieldAlert, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-client-value";

import { CopyButton } from "./copy-button";

import type { ReactNode } from "react";

/**
 * `<ApiExplorer>`: the live "try it" request builder woven into the reference.
 *
 * A developer reads an operation, edits the path params + JSON body in place,
 * pastes their own **test** key, and fires a real sandbox call, without leaving
 * the page. The request goes to our `/api/playground` proxy (NOT directly to the
 * API), which rejects live keys, never logs the key/body, and forwards to the
 * sandbox. The equivalent **curl** + **TypeScript** snippets update live as you
 * type, so "try it" doubles as "copy it".
 *
 * Security posture (mirrors the proxy's hard rules, surfaced in the UI):
 *   - TEST KEYS ONLY. We refuse to send anything that isn't `nbo_test_…`,
 *     with a loud warning. The proxy rejects live keys server-side too; this is
 *     defence in depth, not the only guard.
 *   - The key lives in `localStorage` (so you paste it once across the docs) and
 *     is never sent anywhere but the same-origin proxy.
 *   - Money POSTs get an auto-minted `Idempotency-Key` (regenerate per send).
 *
 * a11y: labelled inputs, a live region for the response status, `aria-busy`
 * while sending. Reduced-motion: the only animation is the spinner, gated by the
 * global `prefers-reduced-motion` CSS in globals.css.
 */

const LS_KEY = "nombaone-docs:test-api-key";

/** Default sandbox base, surfaced in the curl/TS snippets. The proxy reads its
 *  own base from the same env server-side; this is presentation only. */
const API_BASE = process.env.NEXT_PUBLIC_INFRA_API_BASE ?? "https://sandbox.api.nombaone.xyz/v1";

type Method = "GET" | "POST";

interface PathParam {
  /** The `:name` token in the endpoint template. */
  name: string;
  /** Pre-filled example value (e.g. a sample wallet reference). */
  placeholder?: string;
}

interface ApiExplorerProps {
  /** Endpoint template with `:param` tokens, e.g. `/wallets/:id/transfer`. */
  endpoint: string;
  method?: Method;
  /** Required API-key scope, surfaced as a hint. */
  scope?: string;
  /** Money POST → auto `Idempotency-Key`. */
  idempotent?: boolean;
  /** Seed JSON body (object) for the editor. Stringified on mount. */
  defaultBody?: Record<string, unknown>;
  /** Example values for the `:param` tokens, keyed by name. */
  params?: Record<string, string>;
}

/** Extract the `:param` tokens from an endpoint template, in order. */
function extractParams(endpoint: string): PathParam[] {
  return endpoint
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => ({ name: segment.slice(1) }));
}

/** Replace `:param` tokens with their (URL-encoded) values; missing → kept raw. */
function buildPath(endpoint: string, values: Record<string, string>): string {
  return endpoint
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const value = values[segment.slice(1)]?.trim();
      return value ? encodeURIComponent(value) : segment;
    })
    .join("/");
}

/** A short, readable idempotency key (`uuid`-shaped where available). */
function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

type ResponseState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; status: number; ok: boolean; body: string; requestId: string | null }
  | { kind: "error"; message: string };

export function ApiExplorer({
  endpoint,
  method = "GET",
  scope,
  idempotent = false,
  defaultBody,
  params,
}: ApiExplorerProps) {
  const mounted = useMounted();
  // Derived from props; the React Compiler memoizes these for us, no manual
  // useMemo (it fights the compiler's mutability analysis on derived consts).
  const pathParams = extractParams(endpoint);

  // The key persists across the whole docs site (localStorage), read lazily so
  // SSR stays deterministic. We only touch storage on the client.
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(LS_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(pathParams.map((p) => [p.name, params?.[p.name] ?? ""])),
  );

  const [body, setBody] = useState<string>(() =>
    method === "POST" && defaultBody ? JSON.stringify(defaultBody, null, 2) : "",
  );

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    idempotent ? mintIdempotencyKey() : "",
  );

  const [response, setResponse] = useState<ResponseState>({ kind: "idle" });

  // Key classification drives the warning + the send gate.
  const trimmedKey = apiKey.trim();
  const isLiveKey = trimmedKey.startsWith("nbo_live_");
  const isTestKey = trimmedKey.startsWith("nbo_test_");
  const keyInvalidShape = trimmedKey.length > 0 && !isLiveKey && !isTestKey;

  const resolvedPath = buildPath(endpoint, paramValues);
  const hasUnfilledParams = pathParams.some((p) => !paramValues[p.name]?.trim());

  function persistKey(next: string) {
    setApiKey(next);
    try {
      if (next.trim()) window.localStorage.setItem(LS_KEY, next.trim());
      else window.localStorage.removeItem(LS_KEY);
    } catch {
      // Storage can be unavailable (private mode); the key still works in-memory.
    }
  }

  function clearKey() {
    persistKey("");
  }

  async function send() {
    if (isLiveKey) return; // Hard stop: never forward a live key.
    setResponse({ kind: "loading" });

    let parsedBody: unknown;
    if (method === "POST" && body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setResponse({ kind: "error", message: "The request body is not valid JSON." });
        return;
      }
    }

    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          path: resolvedPath,
          apiKey: trimmedKey,
          body: parsedBody,
          idempotencyKey: idempotent ? idempotencyKey : undefined,
        }),
      });
      const text = await res.text();
      setResponse({
        kind: "done",
        status: res.status,
        ok: res.ok,
        body: prettyJson(text),
        requestId: res.headers.get("x-request-id"),
      });
    } catch {
      setResponse({
        kind: "error",
        message: "Could not reach the playground proxy. Check your connection and retry.",
      });
    }
  }

  // Gate the (randomly-minted) key on `mounted` so the server-rendered HTML and
  // the first client render agree (the real key only appears post-hydration).
  const displayKey = mounted ? idempotencyKey : "";
  const curl = buildCurl({ method, path: resolvedPath, idempotent, idempotencyKey: displayKey, body });
  const tsSnippet = buildTs({ method, path: resolvedPath, idempotent, body });

  const sendDisabled =
    response.kind === "loading" || isLiveKey || keyInvalidShape || (method === "POST" && !isTestKey);

  return (
    <section
      className="not-prose my-8 overflow-hidden rounded-xl border border-accent-border bg-card shadow-sm dark:border-accent-border"
      aria-label={`Try ${method} ${endpoint}`}
    >
      {/* Header: the playful "try it" invitation */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-accent-muted px-4 py-2.5 dark:bg-accent-muted">
        <Play size={14} aria-hidden className="text-accent dark:text-accent" />
        <span className="text-sm font-semibold text-accent dark:text-accent">
          Try it, for real
        </span>
        <code className="font-mono text-xs text-muted-foreground">
          {method} {endpoint}
        </code>
        {scope && (
          <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            scope: {scope}
          </span>
        )}
      </header>

      <div className="space-y-4 p-4">
        {/* API key field: the security-critical input */}
        <Field label="Test API key" htmlFor={`${endpoint}-key`}>
          <div className="flex items-center gap-2">
            <span className="pointer-events-none text-muted-foreground">
              <KeyRound size={15} aria-hidden />
            </span>
            <input
              id={`${endpoint}-key`}
              type="password"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={mounted ? apiKey : ""}
              onChange={(event) => persistKey(event.target.value)}
              placeholder="nbo_test_…"
              aria-invalid={isLiveKey || keyInvalidShape}
              className={inputClass(isLiveKey || keyInvalidShape)}
            />
            {apiKey && (
              <button
                type="button"
                onClick={clearKey}
                aria-label="Clear stored key"
                className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {isLiveKey ? (
            <KeyWarning tone="danger">
              That looks like a <strong>live</strong> key. Never paste a live key here: the
              playground refuses it and nothing is sent. Use an <code>nbo_test_…</code> key.
            </KeyWarning>
          ) : keyInvalidShape ? (
            <KeyWarning tone="warning">
              Nombaone keys start with <code>nbo_test_</code>. Double-check what you pasted.
            </KeyWarning>
          ) : (
            <KeyWarning tone="muted">
              Test keys only. Never paste a live key. Your key is stored only in this browser
              (localStorage) and sent only to the same-origin playground proxy.
            </KeyWarning>
          )}
        </Field>

        {/* Path params */}
        {pathParams.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {pathParams.map((param) => (
              <Field key={param.name} label={`:${param.name}`} htmlFor={`${endpoint}-${param.name}`}>
                <input
                  id={`${endpoint}-${param.name}`}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={paramValues[param.name] ?? ""}
                  onChange={(event) =>
                    setParamValues((prev) => ({ ...prev, [param.name]: event.target.value }))
                  }
                  placeholder={params?.[param.name] ?? `nbo…`}
                  className={inputClass(false)}
                />
              </Field>
            ))}
          </div>
        )}

        {/* Body editor (POST only) */}
        {method === "POST" && (
          <Field label="Request body (JSON)" htmlFor={`${endpoint}-body`}>
            <textarea
              id={`${endpoint}-body`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              spellCheck={false}
              rows={Math.min(14, Math.max(4, body.split("\n").length + 1))}
              className="w-full rounded-md border border-border bg-[var(--code-bg)] px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        )}

        {/* Idempotency key (money POST) */}
        {idempotent && (
          <Field label="Idempotency-Key" htmlFor={`${endpoint}-idem`}>
            <div className="flex items-center gap-2">
              <input
                id={`${endpoint}-idem`}
                type="text"
                readOnly
                value={displayKey}
                className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-[13px] text-muted-foreground focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setIdempotencyKey(mintIdempotencyKey())}
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Regenerate
              </button>
            </div>
          </Field>
        )}

        {/* Send */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sendDisabled}
            aria-busy={response.kind === "loading"}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              sendDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            {response.kind === "loading" ? (
              <Loader2 size={15} aria-hidden className="animate-spin" />
            ) : (
              <Play size={15} aria-hidden />
            )}
            {response.kind === "loading" ? "Sending…" : "Send request"}
          </button>
          {hasUnfilledParams && (
            <span className="text-xs text-muted-foreground">
              Fill the path params above to address a real resource.
            </span>
          )}
        </div>

        {/* Response */}
        <ResponsePanel state={response} />

        {/* Live code snippets */}
        <details className="group rounded-lg border border-border bg-muted/30">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-foreground marker:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-accent transition-transform group-open:rotate-90 dark:text-accent">
                ›
              </span>
              Equivalent request (curl / TypeScript)
            </span>
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-3">
            <Snippet label="curl" value={curl} />
            <Snippet label="TypeScript" value={tsSnippet} />
          </div>
        </details>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-mono text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function KeyWarning({
  tone,
  children,
}: {
  tone: "danger" | "warning" | "muted";
  children: ReactNode;
}) {
  const styles = {
    danger: "text-error-700 dark:text-error-400",
    warning: "text-warning-700 dark:text-warning-400",
    muted: "text-muted-foreground",
  } as const;
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[12px] leading-snug [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono",
        styles[tone],
      )}
    >
      {tone === "muted" ? null : (
        <ShieldAlert size={13} aria-hidden className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  );
}

function ResponsePanel({ state }: { state: ResponseState }) {
  if (state.kind === "idle") return null;

  if (state.kind === "loading") {
    return (
      <div
        aria-live="polite"
        className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        Calling the sandbox…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-900/20 dark:text-error-400"
      >
        {state.message}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-xs font-bold",
            state.ok
              ? "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400"
              : "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
          )}
        >
          {state.status}
        </span>
        {state.requestId && (
          <code className="font-mono text-[11px] text-muted-foreground">
            X-Request-Id: {state.requestId}
          </code>
        )}
        <CopyButton value={state.body} className="ml-auto" />
      </div>
      <pre className="max-h-96 overflow-auto bg-[var(--code-bg)] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground">
        {state.body}
      </pre>
    </div>
  );
}

function Snippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-border bg-[var(--code-titlebar-bg)] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <CopyButton value={value} />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground">
        {value}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputClass(invalid: boolean): string {
  return cn(
    "w-full rounded-md border bg-background px-3 py-2 font-mono text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    invalid ? "border-error-300 dark:border-error-800" : "border-border",
  );
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function buildCurl({
  method,
  path,
  idempotent,
  idempotencyKey,
  body,
}: {
  method: Method;
  path: string;
  idempotent: boolean;
  idempotencyKey: string;
  body: string;
}): string {
  const lines = [`curl -X ${method} ${API_BASE}${path} \\`];
  lines.push(`  -H "Authorization: Bearer nbo_test_…" \\`);
  if (method === "POST") {
    lines.push(`  -H "Content-Type: application/json" \\`);
    if (idempotent) lines.push(`  -H "Idempotency-Key: ${idempotencyKey || "…"}" \\`);
    const compact = compactBody(body);
    lines.push(`  -d '${compact}'`);
  } else {
    // Drop the trailing backslash on the last header line.
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
  }
  return lines.join("\n");
}

function buildTs({
  method,
  path,
  idempotent,
  body,
}: {
  method: Method;
  path: string;
  idempotent: boolean;
  body: string;
}): string {
  const headers = [`    Authorization: \`Bearer \${process.env.NOMBAONE_TEST_KEY}\`,`];
  if (method === "POST") {
    headers.push(`    "Content-Type": "application/json",`);
    if (idempotent) headers.push(`    "Idempotency-Key": crypto.randomUUID(),`);
  }
  const lines = [
    `const res = await fetch("${API_BASE}${path}", {`,
    `  method: "${method}",`,
    `  headers: {`,
    ...headers,
    `  },`,
  ];
  if (method === "POST") {
    lines.push(`  body: JSON.stringify(${compactBody(body)}),`);
  }
  lines.push(`});`, `const { data, meta } = await res.json();`);
  return lines.join("\n");
}

/** Re-serialize the editor body to a single line for the inline snippets;
 *  falls back to `{}` when the JSON is mid-edit / invalid. */
function compactBody(body: string): string {
  if (!body.trim()) return "{}";
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return "{}";
  }
}
