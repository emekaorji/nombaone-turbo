import { describe, expect, it } from 'vitest';

import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertLegalTransition, isLegalTransition, LEGAL_TRANSITIONS } from '@nombaone/sara/subscriptions';

import type { SubscriptionStatus } from '@nombaone/core-contracts/types';

const STATES: SubscriptionStatus[] = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
];

describe('subscription FSM (exhaustive)', () => {
  it('every declared legal edge passes', () => {
    for (const edge of LEGAL_TRANSITIONS) {
      const [from, to] = edge.split('->') as [SubscriptionStatus, SubscriptionStatus];
      expect(isLegalTransition(from, to)).toBe(true);
      expect(() => assertLegalTransition(from, to)).not.toThrow();
    }
  });

  it('a no-op (from === to) is always legal (idempotent re-issue)', () => {
    for (const s of STATES) expect(isLegalTransition(s, s)).toBe(true);
  });

  it('canceled is terminal — no outgoing edge', () => {
    for (const to of STATES) {
      if (to === 'canceled') continue;
      expect(isLegalTransition('canceled', to)).toBe(false);
    }
  });

  it('EVERY non-declared, non-noop edge is illegal and throws SUBSCRIPTION_ILLEGAL_TRANSITION', () => {
    for (const from of STATES) {
      for (const to of STATES) {
        if (from === to) continue;
        if (LEGAL_TRANSITIONS.has(`${from}->${to}`)) continue;
        expect(isLegalTransition(from, to)).toBe(false);
        let code: string | undefined;
        try {
          assertLegalTransition(from, to);
        } catch (e) {
          code = (e as { code?: string }).code;
        }
        expect(code).toBe(NOMBAONE_ERROR_CODES.SUBSCRIPTION_ILLEGAL_TRANSITION);
      }
    }
  });

  it('named illegal transitions are rejected (canceled→active, incomplete→past_due)', () => {
    expect(() => assertLegalTransition('canceled', 'active')).toThrow();
    expect(() => assertLegalTransition('incomplete', 'past_due')).toThrow();
  });
});
