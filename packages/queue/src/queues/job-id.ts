/**
 * ── SAFE, COLLISION-FREE JOB IDS ─────────────────────────────────────────────
 *
 * BullMQ namespaces its Redis keys with `:`, so it REJECTS a custom job id containing one:
 *
 *     Error: Custom Id cannot contain :
 *
 * This is not a lint. It throws at `.add()` time, which means the enqueue never happens — and
 * because producers are usually called from a sweep that logs and moves on, a 100%-failure rate
 * looks exactly like "nothing was due". That is precisely how the billing sweep shipped with
 * `jobId = ${subscriptionId}:${periodIndex}` and enqueued ZERO renewals, while the tests stayed
 * green (they call the cycle runner directly and never touch the queue).
 *
 * A job id is an IDEMPOTENCY KEY: BullMQ dedupes on it. So the encoding has to be injective —
 * two different tuples must never collapse to one id, or we would silently drop a real charge.
 * A naive `.replace(/:/g, '_')` is NOT injective (`a:b` and `a_b` collide), and templates here
 * genuinely contain underscores (`renewal_upcoming`), so that shortcut is a money bug waiting to
 * happen.
 *
 * Instead: percent-encode every character outside a conservative allowlist (which excludes `%`
 * itself, so the encoding is reversible), then join the parts with `|` — a character no encoded
 * part can ever contain. Distinct tuples therefore always produce distinct ids.
 */

/** Unreserved, Redis-safe, and — critically — excludes both `:` and `%`. */
const SAFE = /[^A-Za-z0-9._-]/g;

const encodePart = (part: string | number): string =>
  String(part).replace(SAFE, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`);

/**
 * Build a BullMQ-legal job id from its logical parts.
 *
 * Pass the parts SEPARATELY — `jobId(subscriptionId, periodIndex)`, never
 * `jobId(\`${subscriptionId}:${periodIndex}\`)` — otherwise the separator is baked into a single
 * part before this can protect it.
 */
export const jobId = (...parts: (string | number)[]): string => parts.map(encodePart).join('|');
