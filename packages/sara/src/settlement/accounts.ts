import { and, eq } from 'drizzle-orm';

import { orgNombaAccountsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraDb } from '../context';

export interface TenantSubAccount {
  accountRef: string;
  subAccountId: string | null;
  status: string;
}

/**
 * Resolve a tenant's settlement sub-account (H5). A settlement cannot proceed
 * without one — `SETTLEMENT_SUBACCOUNT_NOT_FOUND` if the tenant was never onboarded.
 */
export async function resolveTenantSubAccount(
  db: InfraDb,
  ctx: DomainContext
): Promise<TenantSubAccount> {
  const [row] = await db
    .select()
    .from(orgNombaAccountsTable)
    .where(
      and(
        eq(orgNombaAccountsTable.organizationId, ctx.organizationId),
        eq(orgNombaAccountsTable.environment, ctx.environment),
        eq(orgNombaAccountsTable.kind, 'subaccount')
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.UnprocessableEntity(
      'tenant has no Nomba sub-account; cannot settle',
      { organizationId: ctx.organizationId },
      NOMBAONE_ERROR_CODES.SETTLEMENT_SUBACCOUNT_NOT_FOUND
    );
  }
  return {
    accountRef: row.accountRef,
    subAccountId: row.subAccountId ?? row.nombaAccountId,
    status: row.status,
  };
}
