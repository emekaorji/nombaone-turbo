import { CARD_UPDATE_REASONS, type PaymentFailureReason } from '../nomba/failure-taxonomy';

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
  if (CARD_UPDATE_REASONS.has(reason)) return 'card_update_required';
  if (SHORT_PATH_REASONS.has(reason)) return 'short_path';
  return 'reschedule';
}
