import type { DomainContext } from '../context';

/**
 * Domain events are the append-only spine of auditability: every meaningful
 * state change emits one. Emitting persists a row in `domain_events` AND fans
 * out outbound webhook deliveries. A resource's history is reconstructable by
 * replaying its events. Event types are namespaced `<resource>.<change>`.
 */
export interface EmitEventInput extends DomainContext {
  type: string;
  payload: Record<string, unknown>;
}

export interface EmittedEvent {
  reference: string;
  type: string;
}
