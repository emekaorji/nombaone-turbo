import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk } from './shared';
import { modeEnum } from './shared';
import { orgUsersTable } from './org-users';
import { organizationsTable } from './organizations';

/**
 * Opaque-token session: only the SHA-256 hash of the token is stored; the raw
 * token lives in an httpOnly cookie and is validated against this row each
 * request. The pinned `mode` is the console's active sandbox/live mode.
 */
export const orgSessionsTable = pgTable(
  'org_sessions',
  {
    id: idPk(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => orgUsersTable.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull().default('sandbox'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('org_sessions_token_hash_unique').on(table.tokenHash),
    userIdx: index('org_sessions_user_idx').on(table.userId),
  })
);

export type OrgSessionRow = typeof orgSessionsTable.$inferSelect;
export type OrgSessionInsert = typeof orgSessionsTable.$inferInsert;
