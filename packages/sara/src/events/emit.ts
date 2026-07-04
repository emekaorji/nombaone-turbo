import { and, eq, isNull, or, sql } from 'drizzle-orm';

import {
  domainEventsTable,
  webhookDeliveriesTable,
  webhookEndpointsTable,
  type WebhookEndpointRow,
} from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { InfraDb, InfraTxDb } from '../context';
import type { EmitEventInput, EmittedEvent } from './types';

/**
 * PARADIGM — the transactional outbox / event fan-out.
 *
 * `emitEvent` is the single chokepoint through which EVERY meaningful state
 * change is recorded. It does two inseparable things:
 *
 *   1. Appends an immutable row to `domain_events` (the audit/history spine —
 *      a resource's whole life is reconstructable by replaying its events).
 *   2. Fans the event out to a `webhook_deliveries` row for each of the
 *      tenant's enabled, non-disabled endpoints that subscribes to the type.
 *
 * Delivery rows are written `pending` with `nextAttemptAt = now`; the actual
 * HTTP POST is OUT OF BAND — a worker drains them via `deliverPending` (see
 * `../webhooks/deliver`). This is the classic outbox pattern: persisting the
 * event and the intent-to-deliver in the same write makes "we recorded it but
 * forgot to notify" impossible, while keeping the request path off the wire.
 *
 * Pass a transaction handle (`InfraTxDb`) when the emit must be atomic with the
 * state change that produced it (the common case — emit inside the same tx that
 * mutated the ledger / org / key). A plain read handle works for fire-and-forget
 * emits that need not share a transaction.
 *
 * Scope is pinned: the row is stamped with `ctx.organizationId` /
 * `ctx.mode`, and ONLY endpoints in that same (org, env) are considered.
 */
export const emitEvent = async (
  db: InfraDb | InfraTxDb,
  input: EmitEventInput
): Promise<EmittedEvent> => {
  const reference = mintReference('EVT');

  const [event] = await db
    .insert(domainEventsTable)
    .values({
      reference,
      organizationId: input.organizationId,
      mode: input.mode,
      type: input.type,
      payload: input.payload,
    })
    .returning();

  if (!event) {
    // The insert .returning() always yields a row on success; an empty result
    // means the driver swallowed it, which is a programming/infra fault.
    throw new Error('emitEvent: failed to persist domain event');
  }

  // Endpoints in scope that are enabled (not disabled) AND subscribe to either
  // every event (`*`) or this exact type. Subscription is matched in SQL against
  // the jsonb array so we never over-fetch endpoints.
  const endpoints: WebhookEndpointRow[] = await db
    .select()
    .from(webhookEndpointsTable)
    .where(
      and(
        eq(webhookEndpointsTable.organizationId, input.organizationId),
        eq(webhookEndpointsTable.mode, input.mode),
        isNull(webhookEndpointsTable.disabledAt),
        or(
          sql`${webhookEndpointsTable.enabledEvents} @> ${JSON.stringify(['*'])}::jsonb`,
          sql`${webhookEndpointsTable.enabledEvents} @> ${JSON.stringify([input.type])}::jsonb`
        )
      )
    );

  if (endpoints.length > 0) {
    const now = new Date();
    await db.insert(webhookDeliveriesTable).values(
      endpoints.map((endpoint) => ({
        reference: mintReference('WHD'),
        organizationId: input.organizationId,
        endpointId: endpoint.id,
        eventId: event.id,
        eventType: input.type,
        status: 'pending' as const,
        attempts: 0,
        nextAttemptAt: now,
      }))
    );
  }

  return { reference: event.reference, type: event.type };
};
