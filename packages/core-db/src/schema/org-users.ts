import { boolean, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

export const orgUserRoleEnum = pgEnum('org_user_role', ['owner', 'admin', 'developer', 'viewer']);

/** A console user belonging to exactly one organization. */
export const orgUsersTable = pgTable(
  'org_users',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: orgUserRoleEnum('role').notNull().default('owner'),
    passwordHash: text('password_hash').notNull(),
    /** Encrypted at rest (PII) — see @nombaone/sara/crypto. Null until enrolled. */
    totpSecretEncrypted: text('totp_secret_encrypted'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('org_users_reference_unique').on(table.reference),
    emailUnique: uniqueIndex('org_users_email_unique').on(table.email),
    orgIdx: index('org_users_org_idx').on(table.organizationId),
  })
);

export type OrgUserRow = typeof orgUsersTable.$inferSelect;
export type OrgUserInsert = typeof orgUsersTable.$inferInsert;
