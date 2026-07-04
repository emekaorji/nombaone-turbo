import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { orgUsersTable } from './org-users';
import { organizationsTable } from './organizations';

/**
 * Per-org secret API key. We store ONLY the SHA-256 hash (`key_hash`); the secret
 * is shown once at mint. `key_prefix` (e.g. `nbo_sandbox_a1b2…`) is kept for display.
 * The mode (the account mode) is embedded in the key string and ALSO denormalized here.
 */
export const apiKeysTable = pgTable(
  'api_keys',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => orgUsersTable.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('api_keys_reference_unique').on(table.reference),
    keyHashUnique: uniqueIndex('api_keys_key_hash_unique').on(table.keyHash),
    orgEnvIdx: index('api_keys_org_env_idx').on(table.organizationId, table.mode),
  })
);

export type ApiKeyRow = typeof apiKeysTable.$inferSelect;
export type ApiKeyInsert = typeof apiKeysTable.$inferInsert;
