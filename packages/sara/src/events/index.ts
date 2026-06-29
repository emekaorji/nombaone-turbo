/**
 * `@nombaone/sara/events` — the domain event spine.
 *
 * Re-exports the canonical event shapes and the single emit chokepoint. Apps and
 * sibling clusters import `emitEvent` to record state changes; the outbound
 * webhook fan-out is a side effect of emitting (see `./emit`).
 */
export * from './types';
export * from './emit';
