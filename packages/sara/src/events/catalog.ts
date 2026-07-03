import { WEBHOOK_EVENT_CATALOG, WEBHOOK_EVENT_TYPES, type WebhookEventType } from '@nombaone/core-contracts/types';

/**
 * Producer-facing re-export of the frozen catalog (07/G1). Importing this at an
 * `emitEvent` call site lets a producer assert its type against the union so an
 * undocumented event cannot ship. The catalog is the ONLY place event-type strings
 * are defined.
 */
export { WEBHOOK_EVENT_CATALOG, WEBHOOK_EVENT_TYPES };
export type { WebhookEventType };

/** Identity guard: compiles only for a catalogued type; use at emit sites. */
export const eventType = (type: WebhookEventType): WebhookEventType => type;

const CATALOG_SET: ReadonlySet<string> = new Set(WEBHOOK_EVENT_TYPES);
export const isCatalogEventType = (type: string): type is WebhookEventType => CATALOG_SET.has(type);
