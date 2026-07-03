import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk, referenceCol } from './shared';
import { domainEventsTable } from './domain-events';
import { organizationsTable } from './organizations';
import { webhookEndpointsTable } from './webhook-endpoints';

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'succeeded',
  'failed',
  'dead',
]);

/** One attempt-tracked delivery of a domain event to an endpoint. Retry schedule
 * lives in `next_attempt_at`; a delivery goes `dead` (dead-letter + alert) after
 * the final retry. */
export const webhookDeliveriesTable = pgTable(
  'webhook_deliveries',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpointsTable.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => domainEventsTable.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    responseStatus: integer('response_status'),
    // 07: replay audit — when a dead/failed delivery was last re-armed, and how
    // many times (the ceiling that stops auto-replay retrying a dead endpoint).
    replayedAt: timestamp('replayed_at', { withTimezone: true }),
    replayCount: integer('replay_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('webhook_deliveries_reference_unique').on(table.reference),
    dueIdx: index('webhook_deliveries_due_idx').on(table.status, table.nextAttemptAt),
    // 07: the dead-letter / by-status list view (keyset, tenant-scoped).
    statusListIdx: index('webhook_deliveries_status_list_idx').on(
      table.organizationId,
      table.status,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type WebhookDeliveryRow = typeof webhookDeliveriesTable.$inferSelect;
export type WebhookDeliveryInsert = typeof webhookDeliveriesTable.$inferInsert;
