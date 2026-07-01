import { and, eq, isNull } from 'drizzle-orm';

import { creditGrantsTable, customersTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { ensureAccount, postTransaction } from '../ledger';
import { serializeCreditGrant } from './serialize';
import { customerCreditAccountKey } from './types';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreditGrantResponseData } from './types';

/**
 * Void a credit grant (item 8) — reverse ONLY the UNCONSUMED remainder. A grant may
 * be partially consumed (`remaining < amount`); the consumed part already moved out
 * of `customer_credit` via `applyCreditsOldestFirst`, so reversing the ORIGINAL full
 * posting would over-reverse. Instead we post a fresh balanced `reversal` for
 * `remaining` (debit `customer_credit` liability, credit `platform_revenue`), set
 * `remaining = 0`, and stamp `voided_at`. A fully-consumed grant (`remaining = 0`)
 * just gets stamped `voided_at` (nothing to reverse). Idempotent: an already-voided
 * grant is returned unchanged (no second reversal).
 */
export async function voidCreditGrant(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { reference: string }
): Promise<CreditGrantResponseData> {
  const [grant] = await txDb
    .select()
    .from(creditGrantsTable)
    .where(
      and(
        eq(creditGrantsTable.organizationId, ctx.organizationId),
        eq(creditGrantsTable.environment, ctx.environment),
        eq(creditGrantsTable.reference, input.reference)
      )
    )
    .limit(1);
  if (!grant) {
    throw AppError.NotFound(
      'credit grant not found',
      { reference: input.reference },
      NOMBAONE_ERROR_CODES.CREDIT_GRANT_NOT_FOUND
    );
  }

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, grant.customerId))
    .limit(1);
  const customerRef = customer?.reference ?? '';

  // Idempotent: an already-voided grant is returned as-is (no second reversal).
  if (grant.voidedAt) {
    return serializeCreditGrant(grant, customerRef);
  }

  // Reverse only the unconsumed remainder (0-amount posting is skipped for a
  // fully-consumed grant — nothing left to reverse).
  if (grant.remaining > 0) {
    const creditAccount = await ensureAccount(txDb, ctx, {
      key: customerCreditAccountKey(customerRef),
      kind: 'liability',
    });
    const revenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });
    await postTransaction(txDb, ctx, {
      kind: 'reversal',
      memo: `void credit grant ${grant.reference}`,
      entries: [
        { accountId: creditAccount.id, direction: 'debit', amount: grant.remaining },
        { accountId: revenue.id, direction: 'credit', amount: grant.remaining },
      ],
    });
  }

  const [updated] = await txDb
    .update(creditGrantsTable)
    .set({ remaining: 0, voidedAt: new Date() })
    .where(and(eq(creditGrantsTable.id, grant.id), isNull(creditGrantsTable.voidedAt)))
    .returning();
  // If a concurrent void won, re-read the current row.
  if (!updated) {
    const [current] = await txDb
      .select()
      .from(creditGrantsTable)
      .where(eq(creditGrantsTable.id, grant.id))
      .limit(1);
    return serializeCreditGrant(current ?? grant, customerRef);
  }
  return serializeCreditGrant(updated, customerRef);
}
