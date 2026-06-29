import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

/**
 * The append-only domain event log — the audit/history source AND the feed for
 * outbound webhooks. A resource's history is reconstructable by replaying its
 * events. Emitting a domain event persists a row here, then fans out deliveries.
 */
export const domainEventsTable = pgTable(
  'domain_events',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('domain_events_reference_unique').on(table.reference),
    keysetIdx: index('domain_events_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type DomainEventRow = typeof domainEventsTable.$inferSelect;
export type DomainEventInsert = typeof domainEventsTable.$inferInsert;
