import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk } from './shared';
import { orgUsersTable } from './org-users';

export const passwordResetTokensTable = pgTable(
  'password_reset_tokens',
  {
    id: idPk(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => orgUsersTable.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    tokenIdx: index('password_reset_tokens_token_idx').on(table.tokenHash),
  })
);

export type PasswordResetTokenRow = typeof passwordResetTokensTable.$inferSelect;
