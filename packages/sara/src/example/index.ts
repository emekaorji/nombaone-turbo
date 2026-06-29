/**
 * `@nombaone/sara/example` — the DELETABLE example money-path slice.
 *
 * This domain exists for exactly one reason: to demonstrate, end to end, how the
 * reusable primitives compose into a real money movement, so you have a worked
 * reference before modelling your own domain. It owns no product concept of its
 * own — delete the whole slice (this directory, the `examples` table, the `EXA`
 * reference domain, the example contracts, and the mock rails) once your real
 * domain is in place.
 *
 * The paradigms it threads together:
 *   • the reference as the public id + idempotency + reconciliation join key
 *   • double-entry ledger posting as the single source of truth for money
 *   • the transactional-outbox event emit (domain event + webhook fan-out)
 *   • the rail abstraction for collection (pull succeeds now / push settles later)
 *   • status DERIVED from the ledger, never stored
 *   • reads resolved server-side by reference within the caller's pinned scope
 *   • the inbound-confirm path: confirmed by webhook THEN re-verified, never assumed
 */
export { createExample, deriveExampleStatus } from './create';
export { getExampleByReference, listExamples } from './queries';
export { confirmExampleFromWebhook } from './confirm';
export { serializeExample } from './serialize';
export type {
  CreateExampleInput,
  ListExamplesOptions,
  ConfirmExampleFromWebhookInput,
  ExampleResponseData,
  ExampleKind,
  ExampleStatus,
} from './types';
