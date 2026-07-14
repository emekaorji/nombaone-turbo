import 'server-only';

import { verifyActionToken, type ActionTokenKind } from '@nombaone/sara/actions';

/**
 * The checkout's action-token gate. End-customer links (`/i/<token>` pay an
 * invoice, `/pm/<token>` update a payment method) carry their WHOLE authority
 * in the signed token — kind + resource reference + expiry, HMAC'd with the
 * `INFRA_ACTION_TOKEN_SECRET` this app shares with apps/api (which mints them
 * for dunning/renewal emails). This wrapper binds sara's pure verifier to the
 * env secret and to the ONE kind a page accepts, so a pay-invoice token can
 * never open the update-payment-method page (and vice versa).
 *
 * Returns the authorized resource reference, or `null` on ANY failure —
 * missing secret, bad signature, expired, malformed, or kind mismatch. The
 * pages render `null` as a clean "link expired" state with zero data leak.
 */
export function verifyActionTokenForKind(kind: ActionTokenKind, token: string): string | null {
  const secret = process.env.INFRA_ACTION_TOKEN_SECRET;
  if (!secret) return null; // fail closed — an unset secret must never verify.
  const claim = verifyActionToken(secret, token);
  if (!claim || claim.kind !== kind) return null;
  return claim.ref;
}
