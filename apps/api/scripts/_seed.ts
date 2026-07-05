import {
  organizationsTable,
  orgUsersTable,
  type OrganizationRow,
  type OrgUserRow,
} from '@nombaone/core-db/schema';

import { hashPassword } from '@nombaone/sara/auth';
import { mintReference } from '@nombaone/sara/reference';

import type { InfraTxDb } from '@nombaone/sara/context';

/**
 * Test/dev-only tenant seed for the api's own tooling (the e2e harness + the dev
 * seed scripts). Tenant GENESIS proper (the merchant signup flow) is owned by
 * apps/console — the api never runs it in production (it authenticates with API
 * keys, not sessions). This inlines the minimal org + owner-user creation the api's
 * fixtures need, on the shared reusable primitives (`mintReference`, `hashPassword`),
 * so the api tooling stays self-contained without importing another app.
 */
export async function seedTestOrganization(
  txDb: InfraTxDb,
  input: { organizationName: string; name: string; email: string; password: string }
): Promise<{ organization: OrganizationRow; user: OrgUserRow }> {
  return txDb.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizationsTable)
      .values({ reference: mintReference('ORG'), name: input.organizationName })
      .returning();
    if (!organization) throw new Error('Failed to seed organization');

    const [user] = await tx
      .insert(orgUsersTable)
      .values({
        reference: mintReference('USR'),
        organizationId: organization.id,
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: 'owner',
      })
      .returning();
    if (!user) throw new Error('Failed to seed owner user');

    return { organization, user };
  });
}
