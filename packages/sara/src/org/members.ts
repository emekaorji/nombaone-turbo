import { asc, eq } from 'drizzle-orm';
import { orgUsersTable, type OrgUserRow } from '@nombaone/core-db/schema';

import type { InfraDb } from '../context';

/**
 * PARADIGM — membership is the set of console users sharing one tenant. Listing
 * is scoped to `organization_id` (the unit of isolation) and ordered by creation
 * so the founding OWNER reads first; it is a small, bounded set (a team roster,
 * not a paginated firehose), so it returns a plain array rather than a Page.
 *
 * The "you cannot remove or demote the LAST owner" rule is a deliberate SEAM, not
 * a primitive: it belongs to whichever mutation (remove-member / change-role) a
 * product ships. This module stays read-only so the invariant lives next to the
 * write that must enforce it (MEMBER_LAST_OWNER), never duplicated here.
 */
export const listMembers = async (
  db: InfraDb,
  organizationId: string
): Promise<OrgUserRow[]> => {
  return db
    .select()
    .from(orgUsersTable)
    .where(eq(orgUsersTable.organizationId, organizationId))
    .orderBy(asc(orgUsersTable.createdAt));
};
