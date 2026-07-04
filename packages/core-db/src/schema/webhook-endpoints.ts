import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

/** A tenant's outbound webhook endpoint + its per-tenant HMAC signing secret
 * (hash stored; prefix kept for display). */
export const webhookEndpointsTable = pgTable(
  'webhook_endpoints',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    url: text('url').notNull(),
    enabledEvents: jsonb('enabled_events').$type<string[]>().notNull().default(['*']),
    signingSecretHash: text('signing_secret_hash').notNull(),
    signingSecretPrefix: text('signing_secret_prefix').notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('webhook_endpoints_reference_unique').on(table.reference),
    orgEnvIdx: index('webhook_endpoints_org_env_idx').on(table.organizationId, table.mode),
  })
);

export type WebhookEndpointRow = typeof webhookEndpointsTable.$inferSelect;
export type WebhookEndpointInsert = typeof webhookEndpointsTable.$inferInsert;
