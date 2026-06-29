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
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('webhook_deliveries_reference_unique').on(table.reference),
    dueIdx: index('webhook_deliveries_due_idx').on(table.status, table.nextAttemptAt),
  })
);

export type WebhookDeliveryRow = typeof webhookDeliveriesTable.$inferSelect;
export type WebhookDeliveryInsert = typeof webhookDeliveriesTable.$inferInsert;
