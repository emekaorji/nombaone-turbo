import { and, eq } from 'drizzle-orm';

import { ledgerAccountsTable } from '@nombaone/core-db/schema';

import { listCreditGrants } from './queries';
import { customerCreditAccountKey } from './types';

import type { DomainContext, InfraDb } from '../context';
import type { CreditBalanceResponseData } from './types';

/**
 * The customer's credit balance — read O(1) from the materialized
 * `customer_credit` ledger account (the truth), never summed from grants. Zero when
 * the account does not exist yet (no credit ever granted).
 */
export async function getCreditBalance(
  db: InfraDb,
  ctx: DomainContext,
  customerRef: string
): Promise<number> {
  const [account] = await db
    .select({ balance: ledgerAccountsTable.balance })
    .from(ledgerAccountsTable)
    .where(
      and(
        eq(ledgerAccountsTable.organizationId, ctx.organizationId),
        eq(ledgerAccountsTable.environment, ctx.environment),
        eq(ledgerAccountsTable.key, customerCreditAccountKey(customerRef))
      )
    )
    .limit(1);
  return account?.balance ?? 0;
}

export async function getCreditBalanceResponse(
  db: InfraDb,
  ctx: DomainContext,
  customerRef: string
): Promise<CreditBalanceResponseData> {
  const grants = await listCreditGrants(db, ctx, customerRef);
  const balance = await getCreditBalance(db, ctx, customerRef);
  return { customerId: customerRef, balance, grants };
}
