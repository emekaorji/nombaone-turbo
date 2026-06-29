import { eq } from 'drizzle-orm';
import { organizationsTable, type OrganizationRow } from '@nombaone/core-db/schema';

import type { InfraDb } from '../context';

/**
 * PARADIGM — the organization (TENANT) is the root of the isolation tree, so its
 * own lookup is the one read that is keyed by `organization_id` ALONE rather than
 * by a (org, environment) scope: there is exactly one org row per tenant and it
 * spans both rings. Every OTHER tenant-scoped read filters by the full
 * DomainContext; the org row is the thing that context points AT.
 *
 * Reads return `null` rather than throwing — surfacing "not found" as an HTTP 404
 * (ORG_NOT_FOUND) is the caller's decision, keeping this layer transport-agnostic.
 */
export const getOrganization = async (
  db: InfraDb,
  organizationId: string
): Promise<OrganizationRow | null> => {
  const [row] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId))
    .limit(1);
  return row ?? null;
};
