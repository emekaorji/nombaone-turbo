/**
 * `@nombaone/sara/webhooks` — outbound webhook delivery + operator surface.
 *
 *   - `./sign`        pure HMAC sign/verify (no I/O; symmetric for both ends).
 *   - `./endpoints`   tenant CRUD + rotate over endpoints + hash-at-rest secrets.
 *   - `./deliver`     the out-of-band drain: signed POST, backoff, dead-letter.
 *   - `./deliveries`  read + replay ops over delivery rows (dead-letter + replay G6).
 *   - `./serialize`   row → response DTO mappers.
 *
 * `emitEvent` (in `../events`) writes the `pending` delivery rows; this slice
 * turns them into HTTP and gives operators the dead-letter + replay controls.
 */
export * from './sign';
export * from './endpoints';
export * from './deliver';
export * from './deliveries';
export * from './serialize';
export * from './simulate';
