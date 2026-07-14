"use client";

import { useMemo, useState } from "react";

import { CheckCircle2, KeyRound, ShieldCheck, ShieldX } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * `<WebhookVerifier>`: an interactive, client-side recreation of Nombaone's webhook
 * signature recipe. Paste a raw body, the unix timestamp, and the endpoint's
 * plaintext signing secret; it derives `key = SHA256(secret)` (hex) and computes
 * `HMAC_SHA256(`${timestamp}.${body}`, key)` (hex) via the Web Crypto API and shows
 * the expected `v1=…`. Paste an `X-Nombaone-Signature` header and it renders a
 * constant-time-equivalent pass/fail, teaching verification the same way the
 * receiver does it: no server, no network, nothing leaves the page.
 *
 * This mirrors `signWebhookPayloadV1` / `buildSignatureHeader` from
 * `@nombaone/sara/webhooks` byte-for-byte (the SSOT): the HMAC key is the sha256
 * hex of the plaintext secret, the signed input is `${timestamp}.${rawBody}`, the
 * algorithm is SHA-256, the encoding is hex, and the header is the Stripe-style
 * `t=<unix>,v1=<hex>`.
 *
 * a11y: every input is labelled, the verdict is an `aria-live` region, and the
 * colour-coded result is also stated in text (never colour alone). Dark/light via
 * the `@nombaone/ui` tokens.
 */

const SEED_BODY = `{"id":"nbo7h3k9q2x8m4evt","type":"payment.settled","createdAt":"2026-06-24T09:41:12.004Z","data":{"id":"nbo7h3k9q2x8m4npay","status":"settled","baseAmount":150000,"currency":"NGN"}}`;
const SEED_SECRET = "whsec_nbo_sandbox_demo_secret";
const SEED_TIMESTAMP = "1750758072";

/** Hex-encode an ArrayBuffer (lowercase, no separators); matches `.digest('hex')`. */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the hex HMAC-SHA256 of `${timestamp}.${body}` under
 * `key = sha256(secret)` hex — the plaintext secret is hashed first, exactly as
 * the server and the SDKs do.
 */
async function computeSignature(body: string, secret: string, timestamp: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyHex = toHex(await crypto.subtle.digest("SHA-256", encoder.encode(secret)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return toHex(mac);
}

/** Pull the `v1=` digest out of a `t=<unix>,v1=<hex>` header (whitespace-tolerant). */
function parseV1(header: string): string | null {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((segment) => segment.split("=").map((value) => value.trim()))
      .filter((pair) => pair.length === 2),
  );
  return parts["v1"] ?? null;
}

/** Length-checked equality: the browser stand-in for `timingSafeEqual`. */
function digestsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Field = { id: string; label: string; value: string; placeholder: string; mono?: boolean };

export function WebhookVerifier() {
  const [body, setBody] = useState(SEED_BODY);
  const [secret, setSecret] = useState(SEED_SECRET);
  const [timestamp, setTimestamp] = useState(SEED_TIMESTAMP);
  const [signature, setSignature] = useState("");
  const [expected, setExpected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const provided = useMemo(() => (signature.trim() ? parseV1(signature) : null), [signature]);
  const verdict: "match" | "mismatch" | null =
    expected && provided ? (digestsMatch(expected, provided) ? "match" : "mismatch") : null;

  async function onCompute() {
    setError(null);
    setBusy(true);
    try {
      const digest = await computeSignature(body, secret, timestamp.trim());
      setExpected(digest);
    } catch {
      setExpected(null);
      setError("Could not compute the HMAC. Check that the Web Crypto API is available (HTTPS).");
    } finally {
      setBusy(false);
    }
  }

  const inputs: Field[] = [
    { id: "wv-timestamp", label: "Timestamp (t)", value: timestamp, placeholder: "1750758072", mono: true },
    { id: "wv-secret", label: "Signing secret", value: secret, placeholder: "whsec_…", mono: true },
  ];

  function setField(id: string, value: string) {
    if (id === "wv-timestamp") setTimestamp(value);
    if (id === "wv-secret") setSecret(value);
  }

  return (
    <div className="not-prose my-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Branded header */}
      <div className="flex items-center gap-2.5 border-b border-border bg-gradient-to-r from-accent-muted to-transparent px-4 py-3 dark:from-accent-muted">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground shadow-sm">
          <ShieldCheck size={16} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Signature verifier</p>
          <p className="text-xs text-muted-foreground">
            Computed in your browser with Web Crypto. Nothing is sent anywhere.
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Raw body */}
        <div>
          <label htmlFor="wv-body" className="mb-1.5 block text-xs font-semibold text-foreground">
            Raw request body
          </label>
          <textarea
            id="wv-body"
            value={body}
            spellCheck={false}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-[var(--code-bg)] px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Sign the bytes <strong className="font-semibold">exactly as received</strong>. Do not
            re-serialize the JSON.
          </p>
        </div>

        {/* Timestamp + secret */}
        <div className="grid gap-4 sm:grid-cols-2">
          {inputs.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="mb-1.5 block text-xs font-semibold text-foreground">
                {field.label}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <KeyRound size={13} aria-hidden className="shrink-0 text-muted-foreground" />
                <input
                  id={field.id}
                  value={field.value}
                  spellCheck={false}
                  onChange={(event) => setField(field.id, event.target.value)}
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full bg-transparent py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60",
                    field.mono && "font-mono",
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onCompute}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          <CheckCircle2 size={15} aria-hidden />
          {busy ? "Computing…" : "Compute signature"}
        </button>

        {error && (
          <p role="alert" className="text-xs font-medium text-error-600 dark:text-error-400">
            {error}
          </p>
        )}

        {/* Expected signature */}
        {expected && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Expected X-Nombaone-Signature
            </p>
            <code className="block break-all font-mono text-[12px] text-accent dark:text-accent">
              t={timestamp.trim()},v1={expected}
            </code>
          </div>
        )}

        {/* Compare against a pasted header */}
        <div>
          <label htmlFor="wv-signature" className="mb-1.5 block text-xs font-semibold text-foreground">
            Compare against a received header (optional)
          </label>
          <input
            id="wv-signature"
            value={signature}
            spellCheck={false}
            onChange={(event) => setSignature(event.target.value)}
            placeholder="t=1750758072,v1=…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Verdict */}
        <div aria-live="polite" className="min-h-[1.5rem]">
          {verdict === "match" && (
            <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 text-sm font-medium text-success-800 dark:border-success-900 dark:bg-success-900/20 dark:text-success-300">
              <ShieldCheck size={16} aria-hidden />
              Signatures match. This request is authentic. Process it.
            </div>
          )}
          {verdict === "mismatch" && (
            <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2.5 text-sm font-medium text-error-800 dark:border-error-900 dark:bg-error-900/20 dark:text-error-300">
              <ShieldX size={16} aria-hidden />
              Signatures differ. Reject this request with a 400. Do not trust it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
