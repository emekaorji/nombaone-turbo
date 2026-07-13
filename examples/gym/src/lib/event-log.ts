/**
 * In-memory ring buffer of verified webhook deliveries, surfaced at /events.
 *
 * Webhook delivery is at-least-once, so entries are deduped on the underlying
 * domain event id (`event.event.id`) — a replayed delivery never shows twice.
 * Held on `globalThis` so it survives dev-server HMR; it does NOT survive a
 * process restart (this is a demo log, not a store — `events.list` on the
 * platform is the reconciliation backstop).
 */
import type { WebhookEvent } from '@nombaone/node';

export interface LoggedEvent {
  /** When THIS app received the delivery (ISO). */
  receivedAt: string;
  /** The delivery reference (`nbo…whd`) — unique per delivery attempt. */
  deliveryId: string;
  /** The domain event id (`nbo…evt`) — the dedupe key. */
  eventId: string;
  type: string;
  /** The affected resource's public id, when the payload carries one. */
  reference: string | null;
}

const CAPACITY = 200;

type EventLogStore = {
  __gymEventLog?: { buffer: LoggedEvent[]; seen: Set<string> };
};

const globalStore = globalThis as unknown as EventLogStore;

function log(): { buffer: LoggedEvent[]; seen: Set<string> } {
  if (!globalStore.__gymEventLog) {
    globalStore.__gymEventLog = { buffer: [], seen: new Set() };
  }
  return globalStore.__gymEventLog;
}

/** Record a verified delivery. Returns false when it was a deduped replay. */
export function recordEvent(event: WebhookEvent): boolean {
  const { buffer, seen } = log();
  if (seen.has(event.event.id)) return false;

  const data = event.data as Record<string, unknown>;
  buffer.unshift({
    receivedAt: new Date().toISOString(),
    deliveryId: event.id,
    eventId: event.event.id,
    type: event.type,
    reference: typeof data.reference === 'string' ? data.reference : null,
  });
  seen.add(event.event.id);

  while (buffer.length > CAPACITY) {
    const evicted = buffer.pop();
    if (evicted) seen.delete(evicted.eventId);
  }
  return true;
}

/** Newest first. */
export function listEvents(): LoggedEvent[] {
  return [...log().buffer];
}
