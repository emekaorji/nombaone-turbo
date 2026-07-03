import { describe, expect, it } from 'vitest';

import { maybeSimulateTestCollect, testBehaviorToken } from '@nombaone/sara/rails';

import type { PaymentMethodRow } from '@nombaone/core-db/schema';

/** Minimal payment-method stand-in — only the rail-identifier columns matter here. */
const method = (overrides: Partial<PaymentMethodRow>): PaymentMethodRow =>
  ({ tokenKey: null, mandateId: null, accountRef: null, ...overrides }) as PaymentMethodRow;

describe('rails/test-sim — deterministic test-method simulation', () => {
  it('returns null on a LIVE environment even for a sentinel token (never fires in production)', () => {
    expect(maybeSimulateTestCollect('live', method({ tokenKey: 'test_success' }), 1000)).toBeNull();
  });

  it('returns null for a non-sentinel method (real methods fall through to the real rail)', () => {
    expect(maybeSimulateTestCollect('test', method({ tokenKey: 'tok_live_abc123' }), 1000)).toBeNull();
    expect(maybeSimulateTestCollect('test', method({}), 1000)).toBeNull();
  });

  it('maps success → succeeded', () => {
    expect(
      maybeSimulateTestCollect('test', method({ tokenKey: testBehaviorToken('success') }), 1000)
    ).toEqual({ status: 'succeeded' });
  });

  it('maps each decline behavior → failed with its specific PaymentFailureReason', () => {
    expect(
      maybeSimulateTestCollect(
        'test',
        method({ tokenKey: testBehaviorToken('decline_insufficient_funds') }),
        1000
      )
    ).toEqual({ status: 'failed', failureReason: 'insufficient_funds' });
    expect(
      maybeSimulateTestCollect(
        'test',
        method({ tokenKey: testBehaviorToken('decline_expired_card') }),
        1000
      )
    ).toEqual({ status: 'failed', failureReason: 'expired_card' });
    expect(
      maybeSimulateTestCollect(
        'test',
        method({ tokenKey: testBehaviorToken('decline_do_not_honor') }),
        1000
      )
    ).toEqual({ status: 'failed', failureReason: 'do_not_honor' });
  });

  it('maps requires_otp → requires_action with an otp_3ds step-up', () => {
    const r = maybeSimulateTestCollect(
      'test',
      method({ tokenKey: testBehaviorToken('requires_otp') }),
      1000
    );
    expect(r?.status).toBe('requires_action');
    expect(r?.action?.type).toBe('otp_3ds');
  });

  it('reads the sentinel from a mandate method (mandateId column), not just cards', () => {
    expect(
      maybeSimulateTestCollect('test', method({ mandateId: testBehaviorToken('success') }), 1000)
    ).toEqual({ status: 'succeeded' });
  });

  it('returns a fresh object each call — a caller mutating it cannot corrupt the shared table', () => {
    const a = maybeSimulateTestCollect('test', method({ tokenKey: 'test_requires_otp' }), 1000);
    a!.action!.message = 'mutated';
    const b = maybeSimulateTestCollect('test', method({ tokenKey: 'test_requires_otp' }), 1000);
    expect(b!.action!.message).not.toBe('mutated');
  });
});
