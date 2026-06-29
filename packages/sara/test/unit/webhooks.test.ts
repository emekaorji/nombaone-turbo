import { describe, expect, it } from 'vitest';

import { signWebhookPayload, verifyWebhookSignature } from '@nombaone/sara/webhooks';

/**
 * Outbound webhook authenticity via shared-secret HMAC-SHA256. Sign and verify
 * are symmetric pure functions with no I/O.
 */
describe('webhooks.signWebhookPayload / verifyWebhookSignature', () => {
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
