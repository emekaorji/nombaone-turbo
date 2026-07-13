import { describe, expect, it } from 'vitest';

import {
  buildSignatureHeader,
  signWebhookPayload,
  signWebhookPayloadV1,
  verifySignatureHeader,
  verifyWebhookSignature,
} from '@nombaone/sara/webhooks';

/**
 * Outbound webhook authenticity — the timestamped `t=<unix>,v1=<hex>` scheme.
 * Sign and verify are symmetric pure functions with no I/O.
 */
describe('webhooks.buildSignatureHeader / verifySignatureHeader (t=,v1= scheme)', () => {
  // In production this is the stored signingSecretHash (sha256 of the plaintext).
  const secretHash = 'a'.repeat(64);
  const body = JSON.stringify({ type: 'example.created', data: { amount: 5_000 } });
  const now = 1_752_300_000;

  it('a freshly built header verifies against the same key + body', () => {
    const header = buildSignatureHeader(secretHash, body, now);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignatureHeader(secretHash, body, header, { nowSec: now })).toBe(true);
  });

  it('v1 is HMAC-SHA256(key, `${t}.${rawBody}`) — the timestamp is bound into the digest', () => {
    const header = buildSignatureHeader(secretHash, body, now);
    expect(header).toBe(`t=${now},v1=${signWebhookPayloadV1(secretHash, now, body)}`);
    // The same body at a different t yields a different v1 (t is signed, not decorative).
    expect(signWebhookPayloadV1(secretHash, now + 1, body)).not.toBe(
      signWebhookPayloadV1(secretHash, now, body)
    );
  });

  it('rejects a tampered body', () => {
    const header = buildSignatureHeader(secretHash, body, now);
    expect(verifySignatureHeader(secretHash, `${body} `, header, { nowSec: now })).toBe(false);
  });

  it('rejects a wrong key', () => {
    const header = buildSignatureHeader(secretHash, body, now);
    expect(verifySignatureHeader('b'.repeat(64), body, header, { nowSec: now })).toBe(false);
  });

  it('rejects a stale or future-dated timestamp outside tolerance (default 300s, symmetric)', () => {
    const header = buildSignatureHeader(secretHash, body, now);
    expect(verifySignatureHeader(secretHash, body, header, { nowSec: now + 300 })).toBe(true);
    expect(verifySignatureHeader(secretHash, body, header, { nowSec: now + 301 })).toBe(false);
    expect(verifySignatureHeader(secretHash, body, header, { nowSec: now - 301 })).toBe(false);
    // A custom tolerance widens the window.
    expect(
      verifySignatureHeader(secretHash, body, header, { nowSec: now + 400, toleranceSec: 600 })
    ).toBe(true);
  });

  it('accepts any matching v1 among several (secret rotation)', () => {
    const otherV1 = signWebhookPayloadV1('b'.repeat(64), now, body);
    const goodV1 = signWebhookPayloadV1(secretHash, now, body);
    const header = `t=${now},v1=${otherV1},v1=${goodV1}`;
    expect(verifySignatureHeader(secretHash, body, header, { nowSec: now })).toBe(true);
  });

  it('returns false (never throws) on malformed headers', () => {
    expect(verifySignatureHeader(secretHash, body, '', { nowSec: now })).toBe(false);
    expect(verifySignatureHeader(secretHash, body, 'garbage', { nowSec: now })).toBe(false);
    expect(verifySignatureHeader(secretHash, body, 'v1=deadbeef', { nowSec: now })).toBe(false);
    expect(verifySignatureHeader(secretHash, body, `t=${now}`, { nowSec: now })).toBe(false);
    expect(verifySignatureHeader(secretHash, body, 't=abc,v1=deadbeef', { nowSec: now })).toBe(
      false
    );
  });
});

/**
 * The bare HMAC-over-rawBody primitives — NOT the outbound delivery scheme;
 * still used for inbound generic-provider webhook verification.
 */
describe('webhooks.signWebhookPayload / verifyWebhookSignature (bare primitive)', () => {
  const secret = 'nbo_whsec_deadbeefdeadbeefdeadbeefdeadbeef';
  const body = JSON.stringify({ type: 'example.created', data: { amount: 5_000 } });

  it('a freshly signed payload verifies against the same secret + body', () => {
    const signature = signWebhookPayload(secret, body);
    expect(signature).toMatch(/^[0-9a-f]{64}$/); // lowercase hex sha256
    expect(verifyWebhookSignature(secret, body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const signature = signWebhookPayload(secret, body);
    expect(verifyWebhookSignature(secret, `${body} `, signature)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const signature = signWebhookPayload(secret, body);
    expect(verifyWebhookSignature('nbo_whsec_wrong', body, signature)).toBe(false);
  });

  it('returns false (never throws) on a malformed / empty signature', () => {
    expect(verifyWebhookSignature(secret, body, '')).toBe(false);
    expect(verifyWebhookSignature(secret, body, 'short')).toBe(false);
  });
});
