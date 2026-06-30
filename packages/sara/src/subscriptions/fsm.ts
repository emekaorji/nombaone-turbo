import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { SubscriptionStatus } from '@nombaone/core-contracts/types';

/**
 * ── The subscription lifecycle state machine (contract C.2) ──────────────────
 *
 * The legal `(from → to)` edges. Anything NOT here is illegal and rejected. Note
 * `canceled` has NO outgoing edge — it is terminal; "resubscribe" is a separate op
 * that mints a brand-new subscription, never a transition out of `canceled`. A
 * no-op (from === to) is always allowed (idempotent re-issue, A14).
 */
const EDGES: ReadonlyArray<[SubscriptionStatus, SubscriptionStatus]> = [
  ['incomplete', 'incomplete_expired'],
  ['incomplete', 'active'],
  ['incomplete', 'canceled'],
  ['trialing', 'active'],
  ['trialing', 'canceled'],
  ['active', 'past_due'],
  ['active', 'paused'],
  ['active', 'canceled'],
  ['past_due', 'active'],
  ['past_due', 'canceled'],
  ['paused', 'active'],
  ['paused', 'canceled'],
];

export const LEGAL_TRANSITIONS: ReadonlySet<string> = new Set(EDGES.map(([f, t]) => `${f}->${t}`));

export function isLegalTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return from === to || LEGAL_TRANSITIONS.has(`${from}->${to}`);
}

/** Throws `SUBSCRIPTION_ILLEGAL_TRANSITION` unless the edge is legal (or a no-op). */
export function assertLegalTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!isLegalTransition(from, to)) {
    throw AppError.UnprocessableEntity(
      `illegal subscription transition: ${from} → ${to}`,
      { from, to },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_ILLEGAL_TRANSITION
    );
  }
}

/**
 * The default outbound event for a target status. The `canceled` fork (voluntary
 * `subscription.canceled` vs involuntary `subscription.churned`) is supplied by the
 * caller; this map is the fallback + documentation of the catalog mapping.
 */
export const DEFAULT_EVENT_FOR_STATUS: Record<SubscriptionStatus, string> = {
  incomplete: 'subscription.created',
  incomplete_expired: 'subscription.updated',
  trialing: 'subscription.created',
  active: 'subscription.activated',
  past_due: 'subscription.updated',
  paused: 'subscription.paused',
  canceled: 'subscription.canceled',
};
