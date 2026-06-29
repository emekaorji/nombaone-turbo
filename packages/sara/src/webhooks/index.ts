/**
 * `@nombaone/sara/webhooks` — outbound webhook delivery.
 *
 * Three concerns, one slice:
 *   - `./sign`      pure HMAC sign/verify (no I/O; symmetric for both ends).
 *   - `./endpoints` tenant CRUD over endpoints + hash-at-rest signing secrets.
 *   - `./deliver`   the out-of-band drain: signed POST, backoff, dead-letter.
 *
 * `emitEvent` (in `../events`) writes the `pending` delivery rows; this slice
 * turns them into HTTP.
 */
export * from './sign';
export * from './endpoints';
export * from './deliver';
