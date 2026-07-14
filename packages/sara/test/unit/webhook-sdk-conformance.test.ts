import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildSignatureHeader } from '@nombaone/sara/webhooks';

/**
 * SENDER ↔ SDK CONFORMANCE — a frozen, byte-for-byte fixture of the Node SDK's
 * webhook verifier, run against our real sender-side `buildSignatureHeader`.
 *
 * `sdkVerifySignature` below re-implements EXACTLY what
 * `nombaone-node/src/webhooks.ts` (`Webhooks#verifySignature`, called by
 * `constructEvent`) does:
 *
 *   1. parse the `t=<unix>,v1=<hex>` header (multiple `v1` legal — rotation);
 *   2. reject `t` outside the tolerance window (default 300s, symmetric);
 *   3. derive key = sha256(PLAINTEXT secret) as a hex string — the SDK hashes
 *      the `nbo_whsec_…` plaintext internally; the server stores that hash and
 *      uses it directly as the HMAC key;
 *   4. expected = HMAC-SHA256(key, `${t}.${rawBody}`) hex;
 *   5. constant-time compare against every `v1` candidate.
 *
 * ⚠️ DO NOT "improve" this inline verifier. It is deliberately duplicated, not
 * imported: it freezes the SDK's wire behavior so any sender-side change that
 * would break real merchant verification fails HERE, in this repo. If the
 * protocol changes, update `nombaone-node/src/webhooks.ts` and this fixture IN
 * LOCKSTEP (and the docs recipe pages).
 */

const DEFAULT_TOLERANCE_SECONDS = 300; // mirrors the SDK default

/** Mirror of the SDK's verifySignature. Returns an error string, or null on success. */
const sdkVerifySignature = (
  payload: string,
  signatureHeader: string,
  plaintextSecret: string,
  opts?: { tolerance?: number; nowMs?: number }
): string | null => {
  if (!signatureHeader) return 'missing header';
  if (!plaintextSecret) return 'missing secret';

  // parseSignatureHeader — mirror
  const signatures: string[] = [];
  let timestamp: string | null = null;
  for (const pair of signatureHeader.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1' && value.length > 0) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return 'malformed header';

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return 'malformed timestamp';
  const tolerance = opts?.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  const age = Math.abs((opts?.nowMs ?? Date.now()) / 1000 - timestampSeconds);
  if (age > tolerance) return 'timestamp outside tolerance';

  // computeSignature — mirror: hash the plaintext secret internally, then HMAC.
  const key = createHash('sha256').update(plaintextSecret).digest('hex');
  const expected = createHmac('sha256', key).update(`${timestamp}.${payload}`).digest('hex');

  const matched = signatures.some((candidate) => {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });
  return matched ? null : 'signature mismatch';
};

describe('webhook SDK conformance — sara sender output verifies under the Node SDK recipe', () => {
  const plaintextSecret = 'nbo_whsec_test123';
  // What the server stores and signs with: sha256(plaintext) as hex.
  const secretHash = createHash('sha256').update(plaintextSecret).digest('hex');
  const payload = JSON.stringify({
    id: 'nbo000000000001whd',
    type: 'invoice.paid',
    event: { id: 'nbo000000000001evt', type: 'invoice.paid', createdAt: '2026-07-12T02:00:00.000Z' },
    data: { reference: 'nbo000000000001inv' },
  });

  it('round-trip: a header built by the sender verifies with the SDK recipe + the PLAINTEXT secret', () => {
    const header = buildSignatureHeader(secretHash, payload);
    expect(sdkVerifySignature(payload, header, plaintextSecret)).toBeNull();
  });

  it('the SDK recipe rejects a tampered body', () => {
    const header = buildSignatureHeader(secretHash, payload);
    const tampered = payload.replace('invoice.paid', 'invoice.void');
    expect(sdkVerifySignature(tampered, header, plaintextSecret)).toBe('signature mismatch');
  });

  it('the SDK recipe rejects the wrong plaintext secret', () => {
    const header = buildSignatureHeader(secretHash, payload);
    expect(sdkVerifySignature(payload, header, 'nbo_whsec_wrong')).toBe('signature mismatch');
  });

  it('the SDK recipe rejects a stale timestamp (older than the 300s default tolerance)', () => {
    const staleNowSec = Math.floor(Date.now() / 1000) - 301;
    const header = buildSignatureHeader(secretHash, payload, staleNowSec);
    expect(sdkVerifySignature(payload, header, plaintextSecret)).toBe(
      'timestamp outside tolerance'
    );
    // The same header passes with a widened tolerance — t is enforceable, not decorative.
    expect(sdkVerifySignature(payload, header, plaintextSecret, { tolerance: 600 })).toBeNull();
  });

  it('rotation: any one matching v1 among several passes under the SDK recipe', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = buildSignatureHeader(secretHash, payload, now);
    const [, v1Good] = header.split(',v1=');
    const oldKey = createHash('sha256').update('nbo_whsec_retired').digest('hex');
    const v1Old = createHmac('sha256', oldKey).update(`${now}.${payload}`).digest('hex');
    expect(sdkVerifySignature(payload, `t=${now},v1=${v1Old},v1=${v1Good}`, plaintextSecret)).toBeNull();
  });

  it('freezes the exact bytes: v1 = HMAC-SHA256(sha256(plaintext) hex, `${t}.${body}`)', () => {
    const t = 1_752_300_000;
    const header = buildSignatureHeader(secretHash, payload, t);
    const expectedV1 = createHmac(
      'sha256',
      createHash('sha256').update('nbo_whsec_test123').digest('hex')
    )
      .update(`${t}.${payload}`)
      .digest('hex');
    expect(header).toBe(`t=${t},v1=${expectedV1}`);
  });
});
