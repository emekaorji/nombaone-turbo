/**
 * Edge-safe session cookie constants. Kept in their own module (no
 * `server-only`, no DB/Node imports) so the edge `proxy.ts` can import the
 * cookie name without pulling the server-only `session.ts` (and its DB client)
 * into the edge bundle.
 */

/** Name of the httpOnly cookie holding the opaque session token. */
export const SESSION_COOKIE = 'merchant_session';

/** Session cookie lifetime — matches the 7-day server-side session TTL. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
