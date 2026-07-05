import { CARD_UPDATE_REASONS, type PaymentFailureReason } from '@nombaone/sara/nomba/failure-taxonomy';

import type { DunningBranch } from '@nombaone/core-contracts/types';

/**
 * Reasons for which retrying the CHARGE is futile and the account cannot recover by
 * waiting — the bank has refused (do-not-honor / stolen / invalid) or the mandate is
 * suspended. These take the SHORT PATH: at most one courtesy retry, then exhaustion.
 */
const SHORT_PATH_REASONS: ReadonlySet<PaymentFailureReason> = new Set([
  'hard_decline',
  'do_not_honor',
  'mandate_suspended',
]);

/**
 * The branch decision (D3/D4/D5) — PURE, over the 02 taxonomy, never a raw provider
 * string. `expired_card`/`token_expired` → `card_update_required` (NEVER a blind
 * charge retry — D4 ★); the hard-refusal family → `short_path`; everything else
 * (`insufficient_funds`, `processor_unavailable`, `unknown`) → `reschedule` on the
 * normal (payday-biased) cadence.
 */
export function classifyDunningBranch(reason: PaymentFailureReason): DunningBranch {
  // A bank OTP/3DS step-up needs the SAME card re-authenticated (not a new card), but
  // shares the `card_update_required` HOLD semantics exactly: never blind-retry, prompt
  // the customer once with a fresh checkout link. Reusing the branch avoids a dunning
  // enum migration; the distinction rides on the `invoice.action_required` event.
  if (reason === 'otp_required') return 'card_update_required';
  if (CARD_UPDATE_REASONS.has(reason)) return 'card_update_required';
  if (SHORT_PATH_REASONS.has(reason)) return 'short_path';
  return 'reschedule';
}
