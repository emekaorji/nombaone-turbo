import type { DomainContext } from '../context';
import type { WebhookEventType } from '@nombaone/core-contracts/types';

/**
 * Domain events are the append-only spine of auditability: every meaningful
 * state change emits one. Emitting persists a row in `domain_events` AND fans
 * out outbound webhook deliveries. A resource's history is reconstructable by
 * replaying its events. Event types are namespaced `<resource>.<change>`.
 *
 * `type` is pinned to `WebhookEventType` (the frozen `WEBHOOK_EVENT_CATALOG`
 * union) so an undocumented event cannot ship: an emit site with a type that is
 * not in the catalog fails to compile (item 10 / rubric G1). To emit a new event,
 * add it to the catalog first.
 */
export interface EmitEventInput extends DomainContext {
  type: WebhookEventType;
  payload: Record<string, unknown>;
}

export interface EmittedEvent {
  reference: string;
  type: string;
}
