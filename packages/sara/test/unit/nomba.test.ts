import { describe, expect, it } from 'vitest';

import {
  computeNombaSignature,
  mapGatewayMessage,
  mapNombaEvent,
  verifyNombaSignature,
} from '@nombaone/sara/nomba';

describe('nomba/failure-taxonomy', () => {
  it('maps gatewayMessage to a stable PaymentFailureReason', () => {
    expect(mapGatewayMessage('Insufficient funds')).toBe('insufficient_funds');
    expect(mapGatewayMessage('Card has expired')).toBe('expired_card');
    expect(mapGatewayMessage('Token expired, please re-add card')).toBe('token_expired');
    expect(mapGatewayMessage('Do not honor')).toBe('do_not_honor');
    expect(mapGatewayMessage('Transaction declined')).toBe('hard_decline');
    expect(mapGatewayMessage('Mandate suspended')).toBe('mandate_suspended');
    expect(mapGatewayMessage('Service unavailable, try again')).toBe('processor_unavailable');
    expect(mapGatewayMessage('')).toBe('unknown');
    expect(mapGatewayMessage('something we have never seen')).toBe('unknown');
  });
});

describe('nomba/verify (field-string scheme, byte-confirmed)', () => {
  const key = 'test_signature_key';
  const ts = '2026-07-02T01:18:16Z';
  // The signature covers the colon-joined NESTED payload fields + the nomba-timestamp
  // header (byte-confirmed), not the raw body — so verification keys off the parsed fields.
  const payload = {
    event_type: 'payment_success',
    requestId: 'r-1',
    data: {
      merchant: { userId: 'u-1', walletId: 'w-1' },
      transaction: { transactionId: 'tx-1', type: 'online_checkout', time: ts, responseCode: '' },
    },
  };
  const raw = JSON.stringify(payload);

  it('verifies a correctly-signed payload and rejects tampering', () => {
    const sig = computeNombaSignature(key, raw, payload, ts);
    expect(verifyNombaSignature(key, sig, raw, payload, ts)).toBe(true);
    // tampering a SIGNED (nested) field breaks the signature
    const tampered = {
      ...payload,
      data: { ...payload.data, transaction: { ...payload.data.transaction, transactionId: 'tx-2' } },
    };
    expect(verifyNombaSignature(key, sig, JSON.stringify(tampered), tampered, ts)).toBe(false);
    expect(verifyNombaSignature(key, 'not-the-sig', raw, payload, ts)).toBe(false); // wrong signature
    expect(verifyNombaSignature(key, '', raw, payload, ts)).toBe(false); // missing signature
  });
});

describe('nomba/events', () => {
  it('reconciles team + public event names onto one internal vocabulary', () => {
    expect(mapNombaEvent('payment_success', { data: {} }).type).toBe('payment_succeeded');
    expect(mapNombaEvent('payment_failed', {}).type).toBe('payment_failed');
    expect(mapNombaEvent('payout_failed', {}).type).toBe('transfer_failed');
    expect(mapNombaEvent('transfer.success', {}).type).toBe('transfer_succeeded');
    expect(mapNombaEvent('something_unknown', {}).type).toBe('ignored');
  });

  it('flags a virtual-account funding (vact_transfer) on payment_success', () => {
    const funded = mapNombaEvent('payment_success', {
      data: { transaction: { type: 'vact_transfer' } },
    });
    expect(funded.type).toBe('payment_succeeded');
    expect(funded.isVirtualAccountFunding).toBe(true);

    const card = mapNombaEvent('payment_success', {
      data: { transaction: { type: 'online_checkout' } },
    });
    expect(card.isVirtualAccountFunding).toBe(false);
  });
});
