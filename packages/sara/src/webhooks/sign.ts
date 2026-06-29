import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * PARADIGM — outbound webhook authenticity via shared-secret HMAC.
 *
 * Every delivery we POST carries a signature so the receiving tenant can prove
 * the body came from us and was not tampered with in transit. The signature is
 * `HMAC-SHA256(signingSecret, rawBody)` rendered as lowercase hex. The secret is
 * the per-endpoint signing secret minted at endpoint creation (the plaintext is
 * shown to the tenant exactly once; we persist only its sha256 — see
 * `./endpoints`). Tenants recompute the HMAC over the EXACT raw bytes they
 * received and compare.
 *
 * Signing and verifying are deliberately symmetric pure functions with no I/O,
 * so the same primitive serves both our outbound sender and any inbound
 * verification a tenant copies into their stack.
 */
export const signWebhookPayload = (secret: string, rawBody: string): string =>
  createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

/**
 * Constant-time comparison of an expected vs. provided signature. Returns false
 * (never throws) on any malformed input, and uses `timingSafeEqual` so an
 * attacker cannot learn the correct signature byte-by-byte from response timing.
 */
export const verifyWebhookSignature = (
  secret: string,
  rawBody: string,
  signature: string
): boolean => {
  const expected = signWebhookPayload(secret, rawBody);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature ?? '', 'utf8');
  // timingSafeEqual requires equal-length buffers; a length mismatch is itself a
  // mismatch, so short-circuit without leaking timing on the unequal-length path.
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
};
