import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  organizationsTable,
  type OrganizationRow,
  type OrgUserRow,
} from '@nombaone/core-db/schema';

import { mintReference } from '../reference';
import { ensureSystemAccounts } from '../config';
import { createOrgUser, findUserByEmail } from './users';
import { createSession } from './session';

import type { InfraTxDb } from '../context';

/**
 * PARADIGM — TENANT GENESIS is one ATOMIC transaction. Bringing a new tenant to
 * life is not a sequence of independent writes that could half-succeed; it is a
 * single all-or-nothing unit: (1) the organization row, (2) its first OWNER user,
 * (3) the well-known system ledger accounts that every later money movement
 * assumes already exist, and (4) an open session so signup flows straight into an
 * authenticated console. If ANY step fails the whole thing rolls back and no
 * orphaned org/user/account is left behind.
 *
 * The new tenant always starts in `sandbox` mode — live access is a later,
 * deliberate gate, never the default on day zero.
 *
 * Email uniqueness is checked up front for a clean AUTH_EMAIL_TAKEN, but the
 * `org_users.email` UNIQUE index is the real backstop against a race: a
 * concurrent duplicate violates the index and aborts the transaction.
 */

const SIGNUP_ENVIRONMENT = 'sandbox' as const;

export const signupOrganization = async (
  txDb: InfraTxDb,
  input: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
  }
): Promise<{ organization: OrganizationRow; user: OrgUserRow; token: string }> => {
  return txDb.transaction(async (tx) => {
    const existing = await findUserByEmail(tx, input.email);
    if (existing) {
      throw AppError.Conflict(
        'That email is already registered',
        { email: input.email },
        NOMBAONE_ERROR_CODES.AUTH_EMAIL_TAKEN
      );
    }

    const [organization] = await tx
      .insert(organizationsTable)
      .values({ reference: mintReference('ORG'), name: input.organizationName })
      .returning();

    if (!organization) {
      throw AppError.InternalServerError('Failed to create organization');
    }

    const user = await createOrgUser(tx, {
      organizationId: organization.id,
      email: input.email,
      name: input.name,
      password: input.password,
      role: 'owner',
    });

    // Provision the generic system accounts (cash, platform_revenue, …) the
    // ledger relies on, scoped to the new tenant's starting environment.
    await ensureSystemAccounts(tx, {
      organizationId: organization.id,
      mode: SIGNUP_ENVIRONMENT,
    });

    const { token } = await createSession(tx, {
      userId: user.id,
      organizationId: organization.id,
      mode: SIGNUP_ENVIRONMENT,
    });

    return { organization, user, token };
  });
};
