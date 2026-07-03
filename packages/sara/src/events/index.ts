/**
 * `@nombaone/sara/events` — the domain event spine + the frozen outbound catalog.
 *
 * Re-exports the canonical event shapes, the single emit chokepoint, the frozen
 * `WEBHOOK_EVENT_TYPES` catalog (producers reference it so an undocumented event
 * cannot ship), and the read queries backing `GET /v1/events`.
 */
export * from './types';
export * from './emit';
export * from './catalog';
export * from './queries';
export * from './serialize';
