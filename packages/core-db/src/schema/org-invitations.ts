import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, idPk, referenceCol, updatedAt } from './shared';
import { orgUserRoleEnum, orgUsersTable } from './org-users';
import { organizationsTable } from './organizations';

/** Lifecycle of a team invite: pending → accepted | revoked | expired. */
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'revoked', 'expired']);

/**
 * A pending invitation to join an organization's console. Console-owned team
 * management (auth is console territory). The raw invite token is never stored —
 * only its SHA-256 hash (`token_hash`), exactly like `org_sessions`; the raw token
 * lives only in the one-time invite link the inviter copies. A partial unique
 * index prevents two live invites to the same address. Org-level (not mode-scoped)
 * since a console user belongs to one org across both modes, like `org_users`.
 */
export const orgInvitationsTable = pgTable(
  'org_invitations',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: orgUserRoleEnum('role').notNull().default('developer'),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => orgUsersTable.id, { onDelete: 'set null' }),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('org_invitations_reference_unique').on(table.reference),
    tokenHashUnique: uniqueIndex('org_invitations_token_hash_unique').on(table.tokenHash),
    orgStatusIdx: index('org_invitations_org_status_idx').on(table.organizationId, table.status),
    // At most one live (pending) invite per email per org.
    pendingEmailUnique: uniqueIndex('org_invitations_pending_email_unique')
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
  })
);

export type OrgInvitationRow = typeof orgInvitationsTable.$inferSelect;
export type OrgInvitationInsert = typeof orgInvitationsTable.$inferInsert;
