import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  buildFieldSigningString,
  computeNombaSignature,
  verifyNombaSignature,
} from '@nombaone/sara/nomba';

/**
 * Byte-confirmed against a REAL prod `payment_success` webhook (2026-07-02). The scheme
 * is HMAC-SHA256(base64) over a colon-joined string of NESTED fields + the trailing
 * `nomba-timestamp` header. This fixture pins the exact field order + nested extraction
 * so it can never silently regress.
 */
const PAYLOAD = {
  event_type: 'payment_success',
  requestId: '47e6b936-733d-4a91-b37a-df4f3268650c',
  data: {
    merchant: { walletId: '6a3be2fea3da553c0da52a3b', walletBalance: 98.6, userId: 'e575a906-1eb0-44ef-88c6-a9cf07ad97ea' },
    tokenizedCardData: { tokenKey: 'N/A' },
    transaction: {
      fee: 1.4,
      type: 'online_checkout',
      transactionId: 'WEB-ONLINE_C-E575A-b9e21011-df2b-421d-b1b5-99829b3a6270',
      responseCode: '',
      merchantTxRef: '9PSB260702021811832087201',
      transactionAmount: 100.0,
      time: '2026-07-02T01:18:16Z',
    },
    order: {
      amount: 100.0,
      orderId: 'ddc59174-e0bd-4678-a98d-09ff8e33c1f8',
      accountId: 'e575a906-1eb0-44ef-88c6-a9cf07ad97ea',
      orderReference: 'nbo1782954562198livetest',
      paymentMethod: 'bank_transfer',
      currency: 'NGN',
    },
  },
} as Record<string, unknown>;

const HEADER_TS = '2026-07-02T01:18:16Z';
// The exact string Nomba HMAC'd (recovered by matching the real nomba-signature).
const EXPECTED_SIGNING_STRING =
  'payment_success:47e6b936-733d-4a91-b37a-df4f3268650c:e575a906-1eb0-44ef-88c6-a9cf07ad97ea:6a3be2fea3da553c0da52a3b:WEB-ONLINE_C-E575A-b9e21011-df2b-421d-b1b5-99829b3a6270:online_checkout:2026-07-02T01:18:16Z::2026-07-02T01:18:16Z';

describe('nomba webhook signature (byte-confirmed 2026-07-02)', () => {
  it('builds the exact colon-joined nested field string + header timestamp', () => {
    expect(buildFieldSigningString(PAYLOAD, HEADER_TS)).toBe(EXPECTED_SIGNING_STRING);
  });

  it('computeNombaSignature = HMAC-SHA256(base64) of that string', () => {
    const secret = 'test_webhook_secret';
    const raw = JSON.stringify(PAYLOAD);
    const expected = createHmac('sha256', secret).update(EXPECTED_SIGNING_STRING, 'utf8').digest('base64');
    expect(computeNombaSignature(secret, raw, PAYLOAD, HEADER_TS)).toBe(expected);
  });

  it('verifies a genuine signature and rejects tampering / wrong secret / missing ts', () => {
    const secret = 'test_webhook_secret';
    const raw = JSON.stringify(PAYLOAD);
    const sig = computeNombaSignature(secret, raw, PAYLOAD, HEADER_TS);
    expect(verifyNombaSignature(secret, sig, raw, PAYLOAD, HEADER_TS)).toBe(true);

    // tamper a signed field → the same sig no longer verifies
    const tampered = JSON.parse(raw) as typeof PAYLOAD & { data: { transaction: Record<string, unknown> } };
    tampered.data.transaction.transactionId = 'HACKED';
    expect(verifyNombaSignature(secret, sig, JSON.stringify(tampered), tampered, HEADER_TS)).toBe(false);

    // wrong secret → reject
    expect(verifyNombaSignature('wrong-secret', sig, raw, PAYLOAD, HEADER_TS)).toBe(false);
    // the header timestamp is part of the signed material → a different ts fails
    expect(verifyNombaSignature(secret, sig, raw, PAYLOAD, '2026-07-02T09:99:99Z')).toBe(false);
  });
});
