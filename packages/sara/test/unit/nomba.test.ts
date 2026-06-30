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

describe('nomba/verify', () => {
  const key = 'test_signature_key';
  const body = JSON.stringify({ event_type: 'payment_success', requestId: 'r-1', data: {} });

  it('verifies a correctly-signed body and rejects tampering', () => {
    const sig = computeNombaSignature(key, body);
    expect(verifyNombaSignature(key, sig, body)).toBe(true);
    expect(verifyNombaSignature(key, sig, `${body} `)).toBe(false); // tampered body
    expect(verifyNombaSignature(key, 'deadbeef', body)).toBe(false); // wrong signature
    expect(verifyNombaSignature(key, '', body)).toBe(false); // missing signature
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
