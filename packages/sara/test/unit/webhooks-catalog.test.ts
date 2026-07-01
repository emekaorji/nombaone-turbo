import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  WEBHOOK_DELIVERY_GUARANTEE,
  WEBHOOK_EVENT_CATALOG,
  WEBHOOK_EVENT_TYPES,
} from '@nombaone/core-contracts/types';
import {
  backoffFor,
  MAX_ATTEMPTS,
  signWebhookPayload,
  verifyWebhookSignature,
} from '@nombaone/sara/webhooks';

describe('webhooks/sign — the frozen wire contract (G2/N3)', () => {
  it('a tenant that recomputes key = sha256(secret) then HMAC-SHA256(key, rawBody) matches our signature', () => {
    const plaintextSecret = 'nbo_whsec_deadbeef';
    const rawBody = JSON.stringify({ id: 'nbo1whd', type: 'invoice.paid', data: {} });

    // Our sender signs with the AT-REST key (sha256 of the plaintext).
    const key = createHash('sha256').update(plaintextSecret).digest('hex');
    const ours = signWebhookPayload(key, rawBody);

    // The documented tenant recipe, computed independently.
    const tenant = createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
    expect(tenant).toBe(ours);
    expect(verifyWebhookSignature(key, rawBody, tenant)).toBe(true);
    expect(verifyWebhookSignature(key, rawBody, 'deadbeef')).toBe(false);
    // A different key (post-rotation) must NOT verify (rotation safety).
    const otherKey = createHash('sha256').update('nbo_whsec_other').digest('hex');
    expect(verifyWebhookSignature(otherKey, rawBody, ours)).toBe(false);
  });
});

describe('webhooks/catalog — the frozen event set (G1/G5/G7)', () => {
  it('every catalogued type has a payload shape + a when descriptor', () => {
    for (const type of WEBHOOK_EVENT_TYPES) {
      const entry = WEBHOOK_EVENT_CATALOG[type];
      expect(Array.isArray(entry.payload)).toBe(true);
      expect(entry.when.length).toBeGreaterThan(0);
    }
  });

  it('includes the minimum G1 set', () => {
    for (const t of [
      'subscription.created',
      'subscription.updated',
      'subscription.canceled',
      'invoice.paid',
      'invoice.payment_failed',
      'invoice.payment_recovered',
    ] as const) {
      expect(WEBHOOK_EVENT_TYPES).toContain(t);
    }
  });

  it('states an at-least-once delivery guarantee (G5)', () => {
    expect(WEBHOOK_DELIVERY_GUARANTEE).toBe('at-least-once');
  });
});

describe('webhooks/backoff — exponential schedule + dead-letter transition (G3)', () => {
  it('backoffFor yields the documented [10s, 1m, 5m, 30m, 2h] schedule, clamped', () => {
    expect(backoffFor(1)).toBe(10_000);
    expect(backoffFor(2)).toBe(60_000);
    expect(backoffFor(3)).toBe(300_000);
    expect(backoffFor(4)).toBe(1_800_000);
    expect(backoffFor(5)).toBe(7_200_000);
    expect(backoffFor(6)).toBe(7_200_000); // clamped to the last slot
    expect(MAX_ATTEMPTS).toBe(6);
  });
});
