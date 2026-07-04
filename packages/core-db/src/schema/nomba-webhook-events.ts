import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

/**
 * Inbound provider (Nomba) webhook events — the DURABLE dedup spine (F2). BullMQ
 * collapses redeliveries in-flight, but the contract requires durability: a
 * `unique(provider, request_id)` makes "process the same event twice" structurally
 * impossible, so a unique violation on insert means "already seen → ack, no-op".
 * `organization_id` is nullable: it is resolved while settling, not at ingest.
 */
export const nombaWebhookEventStatusEnum = pgEnum('nomba_webhook_event_status', [
  'received',
  'processed',
  'ignored',
  'failed',
]);

export const nombaWebhookEventsTable = pgTable(
  'nomba_webhook_events',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id').references(() => organizationsTable.id, {
      onDelete: 'set null',
    }),
    mode: modeEnum('mode').notNull(),
    provider: text('provider').notNull().default('nomba'),
    requestId: text('request_id').notNull(),
    eventType: text('event_type').notNull(),
    status: nombaWebhookEventStatusEnum('status').notNull().default('received'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('nomba_webhook_events_reference_unique').on(table.reference),
    providerRequestUnique: uniqueIndex('nomba_webhook_events_provider_request_unique').on(
      table.provider,
      table.requestId
    ),
    keysetIdx: index('nomba_webhook_events_keyset_idx').on(
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type NombaWebhookEventRow = typeof nombaWebhookEventsTable.$inferSelect;
export type NombaWebhookEventInsert = typeof nombaWebhookEventsTable.$inferInsert;
