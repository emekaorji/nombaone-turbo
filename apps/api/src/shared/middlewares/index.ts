/**
 * ── The per-route middleware stack ─────────────────────────────────────────
 *
 * Scoped endpoints compose these in ONE FIXED ORDER, and the order is load-
 * bearing:
 *
 *   auth → rate-limit → scope → idempotency → validate → handler
 *
 *   1. apiKeyAuth     — establish the trusted principal (`req.apiKey`). Nothing
 *                       downstream trusts client-supplied org/env.
 *   2. rateLimit      — throttle per authenticated key (needs `req.apiKey`).
 *   3. requireScope   — authorize the principal for THIS endpoint.
 *   4. idempotency    — only after we know WHO is calling (key namespaces the
 *                       idempotency record) and that they're ALLOWED to.
 *   5. validate       — coerce/validate body/query/params last, so we never
 *                       spend validation work on an unauthenticated/forbidden/
 *                       rate-limited request.
 *   6. handler        — the tiny controller that calls into sara.
 *
 * `platformGate` is mounted app-wide (see `app/main/app.ts`), in front of the
 * routers, so a maintenance pause covers every mutating path uniformly.
 */
export { apiKeyAuth } from './api-key';
export { requireScope } from './scope';
export { idempotency } from './idempotency';
export { rateLimit } from './rate-limit';
export { platformGate } from './platform-gate';
