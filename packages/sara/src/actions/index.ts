/**
 * `@nombaone/sara/actions` — signed, expiring end-customer action tokens.
 *
 *   - `./token`  mint/verify the `base64url(payload).base64url(hmac)` tokens
 *                that authorize the hosted checkout's `/i/<token>` (pay
 *                invoice) and `/pm/<token>` (update payment method) pages.
 *
 * Pure functions, no I/O — the shared `INFRA_ACTION_TOKEN_SECRET` is supplied
 * by the caller (apps/api mints; apps/checkout verifies).
 */
export * from './token';
