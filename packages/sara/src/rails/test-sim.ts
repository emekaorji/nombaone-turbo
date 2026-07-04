import type { TestMethodBehavior } from '@nombaone/core-contracts/validations';
import type { PaymentMethodRow } from '@nombaone/core-db/schema';
import type { Mode } from '../context';
import type { Kobo } from '../money';
import type { RailCollectResult } from './types';

/**
 * ── Test-mode deterministic rail simulation ─────────────────────────────────
 * A test payment method (seeded by the `/v1/sandbox/payment-methods` helper) stores
 * a `test_*` sentinel in its rail identifier column (token_key / mandate_id /
 * account_ref). When such a method is charged ON A TEST DEPLOYMENT, we short-
 * circuit the rail with a deterministic outcome — never touching the network — so
 * a developer can drive success / decline / OTP-step-up flows on demand.
 *
 * This is the ONLY place we branch a money path on mode. It is safe
 * because it returns `null` (⇒ fall through to the real rail) whenever the
 * mode is not `test` OR the method carries no sentinel, so live behavior
 * is byte-for-byte unchanged. A real deployment is env-pinned to `live`, so this
 * can never fire there even if a value collided.
 */

/** The sentinel stored on a test method's rail-identifier column, per behavior. */
export const testBehaviorToken = (behavior: TestMethodBehavior): string => `test_${behavior}`;

const TOKEN_RESULT: Readonly<Record<string, RailCollectResult>> = {
  test_success: { status: 'succeeded' },
  test_decline_insufficient_funds: { status: 'failed', failureReason: 'insufficient_funds' },
  test_decline_expired_card: { status: 'failed', failureReason: 'expired_card' },
  test_decline_do_not_honor: { status: 'failed', failureReason: 'do_not_honor' },
  test_requires_otp: {
    status: 'requires_action',
    action: { type: 'otp_3ds', message: 'Simulated 3-D Secure / OTP step-up (sandbox mode).' },
  },
};

/**
 * Return a deterministic collect result for a test method, or `null` to fall
 * through to the real rail. Pure + synchronous — the sentinel fully determines the
 * outcome (independent of amount/reference), so retries stay consistent.
 */
export function maybeSimulateTestCollect(
  mode: Mode,
  method: PaymentMethodRow,
  _amountKobo: Kobo
): RailCollectResult | null {
  if (mode !== 'sandbox') return null;
  const sentinel = method.tokenKey ?? method.mandateId ?? method.accountRef ?? null;
  if (!sentinel) return null;
  const result = TOKEN_RESULT[sentinel];
  // Clone so a caller mutating the result can never corrupt the shared table.
  return result ? { ...result, ...(result.action ? { action: { ...result.action } } : {}) } : null;
}
