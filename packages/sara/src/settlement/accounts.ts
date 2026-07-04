import { and, eq } from 'drizzle-orm';

import { ledgerAccountsTable, orgNombaAccountsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraReadScope } from '../context';

/** The ledger account key holding a tenant's withdrawable settled balance. */
export const tenantSettlementAccountKey = (accountRef: string): string =>
  `tenant_settlement:${accountRef}`;

export interface TenantSubAccount {
  accountRef: string;
  subAccountId: string | null;
  status: string;
}

/**
 * Resolve a tenant's settlement sub-account (H5). A settlement cannot proceed
 * without one — `SETTLEMENT_SUBACCOUNT_NOT_FOUND` if the tenant was never onboarded.
 */
export async function findTenantSubAccount(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<TenantSubAccount | null> {
  const [row] = await db
    .select()
    .from(orgNombaAccountsTable)
    .where(
      and(
        eq(orgNombaAccountsTable.organizationId, ctx.organizationId),
        eq(orgNombaAccountsTable.mode, ctx.mode),
        eq(orgNombaAccountsTable.kind, 'subaccount')
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    accountRef: row.accountRef,
    subAccountId: row.subAccountId ?? row.nombaAccountId,
    status: row.status,
  };
}

/** Like {@link findTenantSubAccount} but throws when the tenant was never onboarded. */
export async function resolveTenantSubAccount(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<TenantSubAccount> {
  const found = await findTenantSubAccount(db, ctx);
  if (!found) {
    throw AppError.UnprocessableEntity(
      'tenant has no Nomba sub-account; cannot settle',
      { organizationId: ctx.organizationId },
      NOMBAONE_ERROR_CODES.SETTLEMENT_SUBACCOUNT_NOT_FOUND
    );
  }
  return found;
}

/**
 * The tenant's withdrawable settled balance — read O(1) from the materialized
 * `tenant_settlement:{accountRef}` ledger account (a liability CREDITED at
 * settlement, so its `balance` is a POSITIVE number = the tenant's owed funds).
 * Zero when no settlement has landed yet.
 */
export async function getTenantSettlementBalance(db: InfraReadScope, ctx: DomainContext): Promise<number> {
  const sub = await resolveTenantSubAccount(db, ctx);
  const [account] = await db
    .select({ balance: ledgerAccountsTable.balance })
    .from(ledgerAccountsTable)
    .where(
      and(
        eq(ledgerAccountsTable.organizationId, ctx.organizationId),
        eq(ledgerAccountsTable.mode, ctx.mode),
        eq(ledgerAccountsTable.key, tenantSettlementAccountKey(sub.accountRef))
      )
    )
    .limit(1);
  return account?.balance ?? 0;
}
