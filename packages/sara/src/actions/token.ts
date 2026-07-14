import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * PARADIGM — signed, expiring END-CUSTOMER action links.
 *
 * The platform emails end subscribers links into the hosted checkout
 * (`/i/<token>` pay-an-invoice, `/pm/<token>` update-payment-method). Those
 * pages are UNAUTHENTICATED, so the token itself is the whole authority: it
 * names ONE action (`kind`) on ONE resource (`ref`) until ONE instant (`exp`),
 * and is signed with the shared `INFRA_ACTION_TOKEN_SECRET` so nobody can mint
 * or alter one. Format:
 *
 *   base64url(JSON {kind, ref, exp}) + '.' + base64url(HMAC-SHA256(secret, payloadB64))
 *
 * The HMAC is computed over the ENCODED payload segment (the exact bytes in the
 * URL), so there is no canonicalization gap between what was signed and what is
 * verified. `verifyActionToken` never throws — bad signature, expiry, or any
 * malformed input all return `null` — and compares signatures in constant time
 * (`timingSafeEqual`), mirroring `../webhooks/sign`. The token carries NO
 * secret data: the payload is readable by design; only its authenticity and
 * freshness are protected.
 */

/** The closed set of end-customer actions a token can authorize. */
export type ActionTokenKind = 'pay-invoice' | 'update-pm';

const ACTION_TOKEN_KINDS: ReadonlySet<string> = new Set<ActionTokenKind>([
  'pay-invoice',
  'update-pm',
]);

const signPayload = (secret: string, payloadB64: string): string =>
  createHmac('sha256', secret).update(payloadB64, 'utf8').digest().toString('base64url');

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual requires equal-length buffers; a length mismatch is itself a
  // mismatch, so short-circuit without leaking timing on the unequal-length path.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Mint a signed action token authorizing `kind` on `ref` for the next `expSec`
 * seconds (TTL from now; the absolute unix-seconds deadline is embedded as
 * `exp`). The result is URL-safe (base64url segments joined by '.').
 */
export function mintActionToken(
  secret: string,
  input: { kind: ActionTokenKind; ref: string; expSec: number }
): string {
  const payload = {
    kind: input.kind,
    ref: input.ref,
    exp: Math.floor(Date.now() / 1000) + input.expSec,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${signPayload(secret, payloadB64)}`;
}

/**
 * Verify an action token. Returns the authorized `{kind, ref}` claim, or `null`
 * on ANY failure — bad signature, wrong secret, expired, or malformed in any
 * way. Never throws: the checkout page turns `null` into a clean
 * "link expired" state with zero data leak. The signature is checked BEFORE the
 * payload is parsed, so unauthenticated input never reaches `JSON.parse`
 * shape-handling beyond a failed HMAC.
 */
export function verifyActionToken(
  secret: string,
  token: string
): { kind: ActionTokenKind; ref: string } | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts as [string, string];
  if (payloadB64.length === 0 || signature.length === 0) return null;

  // Authenticate first — the HMAC is over the encoded segment as received.
  if (!constantTimeEquals(signPayload(secret, payloadB64), signature)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload == null || typeof payload !== 'object') return null;

  const { kind, ref, exp } = payload as { kind?: unknown; ref?: unknown; exp?: unknown };
  if (typeof kind !== 'string' || !ACTION_TOKEN_KINDS.has(kind)) return null;
  if (typeof ref !== 'string' || ref.length === 0) return null;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  if (Math.floor(Date.now() / 1000) >= exp) return null;

  return { kind: kind as ActionTokenKind, ref };
}
