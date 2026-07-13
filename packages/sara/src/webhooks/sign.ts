import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * PARADIGM — outbound webhook authenticity via shared-secret HMAC, in the
 * timestamped `t=<unix>,v1=<hex>` header scheme.
 *
 * Every delivery we POST carries an `x-nombaone-signature` header of the form
 * `t=<unix seconds>,v1=<hex>`, where
 *
 *   v1 = HMAC-SHA256(key, `${t}.${rawBody}`)   // lowercase hex
 *
 * The KEY is the endpoint's stored `signingSecretHash` — the sha256 (hex) of the
 * plaintext signing secret minted at endpoint creation (the plaintext
 * `nbo_whsec_…` is shown to the tenant exactly once; we persist only its sha256 —
 * see `./endpoints`). A tenant (or our Node SDK) verifying a delivery recomputes
 * `key = sha256(plaintextSecret)` once, then HMACs `${t}.${rawBody}` over the
 * EXACT raw bytes received and compares in constant time. Binding `t` into the
 * signed message lets receivers reject stale deliveries (replay protection);
 * multiple `v1` entries in one header are legal during secret rotation.
 *
 * This scheme MUST stay in lockstep with `nombaone-node/src/webhooks.ts` — the
 * conformance fixture in `test/unit/webhook-sdk-conformance.test.ts` freezes it.
 *
 * Signing and verifying are deliberately symmetric pure functions with no I/O.
 * (`signWebhookPayload` / `verifyWebhookSignature` below are the bare
 * HMAC-over-rawBody primitives — kept for inbound generic-provider webhooks,
 * which use their own untimestamped scheme.)
 */

/** Default verification tolerance (seconds) — mirrors the SDK's 300s default. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Bare primitive: HMAC-SHA256(key, rawBody) as lowercase hex. Not the outbound
 * delivery scheme (see `signWebhookPayloadV1`) — used by inbound generic-provider
 * verification. */
export const signWebhookPayload = (secret: string, rawBody: string): string =>
  createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

/**
 * The outbound `v1` digest: HMAC-SHA256(secretHash, `${timestampSec}.${rawBody}`)
 * as lowercase hex. `secretHash` is the stored sha256-hex of the plaintext secret.
 */
export const signWebhookPayloadV1 = (
  secretHash: string,
  timestampSec: number,
  rawBody: string
): string =>
  createHmac('sha256', secretHash).update(`${timestampSec}.${rawBody}`, 'utf8').digest('hex');

/**
 * Build the full `x-nombaone-signature` header value: `t=<unix>,v1=<hex>`.
 * `nowSec` defaults to the current unix time; injectable for tests.
 */
export const buildSignatureHeader = (
  secretHash: string,
  rawBody: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): string => `t=${nowSec},v1=${signWebhookPayloadV1(secretHash, nowSec, rawBody)}`;

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual requires equal-length buffers; a length mismatch is itself a
  // mismatch, so short-circuit without leaking timing on the unequal-length path.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Verify a `t=<unix>,v1=<hex>` header against the raw body. Returns false
 * (never throws) on malformed input, a stale/future `t` outside `toleranceSec`
 * (default 300s, symmetric), or no matching `v1`. Any one matching `v1` among
 * several passes (secret rotation). `nowSec` is injectable for tests.
 */
export const verifySignatureHeader = (
  secretHash: string,
  rawBody: string,
  headerValue: string,
  opts?: { toleranceSec?: number; nowSec?: number }
): boolean => {
  if (!headerValue) return false;

  let timestampRaw: string | null = null;
  const candidates: string[] = [];
  for (const pair of headerValue.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key === 't') timestampRaw = value;
    // Multiple `v1` entries are legal during secret rotation — any match passes.
    if (key === 'v1' && value.length > 0) candidates.push(value);
  }
  if (timestampRaw === null || candidates.length === 0) return false;

  const timestampSec = Number(timestampRaw);
  if (!Number.isFinite(timestampSec)) return false;

  const toleranceSec = opts?.toleranceSec ?? SIGNATURE_TOLERANCE_SECONDS;
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > toleranceSec) return false;

  const expected = signWebhookPayloadV1(secretHash, timestampSec, rawBody);
  return candidates.some((candidate) => constantTimeEquals(candidate, expected));
};

/**
 * Constant-time comparison of a bare-hex signature (the untimestamped primitive).
 * Returns false (never throws) on any malformed input, and uses `timingSafeEqual`
 * so an attacker cannot learn the correct signature byte-by-byte from response
 * timing. Used by inbound generic-provider webhook verification — NOT the
 * outbound delivery scheme.
 */
export const verifyWebhookSignature = (
  secret: string,
  rawBody: string,
  signature: string
): boolean => constantTimeEquals(signWebhookPayload(secret, rawBody), signature ?? '');
