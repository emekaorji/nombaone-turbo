import { and, asc, eq, gt, sql } from 'drizzle-orm';

import { creditGrantsTable } from '@nombaone/core-db/schema';

import { ensureAccount, postTransaction } from '../ledger';
import { consumeGrants } from './consume';
import { customerCreditAccountKey } from './types';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreditLine } from './types';

/**
 * Apply available credit to `amountDue`, OLDEST-FIRST (C8 ★). Walks the customer's
 * grants `created_at asc, id asc`, consuming `remaining` until covered or exhausted;
 * decrements each grant, posts ONE balanced `adjustment` for the total (debit the
 * `customer_credit` liability, credit platform_revenue — recognizing the covered
 * amount, J5), and returns one explicit `credit` line per consumed grant. The
 * consumed set is a pure function of the ordered grant ledger (deterministic/replayable).
 */
export async function applyCreditsOldestFirst(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { customerId: string; customerRef: string; amountDue: number }
): Promise<{ lines: CreditLine[]; totalApplied: number }> {
  if (input.amountDue <= 0) return { lines: [], totalApplied: 0 };

  const grants = await txDb
    .select({
      id: creditGrantsTable.id,
      reference: creditGrantsTable.reference,
      remaining: creditGrantsTable.remaining,
    })
    .from(creditGrantsTable)
    .where(
      and(
        eq(creditGrantsTable.organizationId, ctx.organizationId),
        eq(creditGrantsTable.environment, ctx.environment),
        eq(creditGrantsTable.customerId, input.customerId),
        gt(creditGrantsTable.remaining, 0)
      )
    )
    .orderBy(asc(creditGrantsTable.createdAt), asc(creditGrantsTable.id));

  const consumptions = consumeGrants(grants, input.amountDue);
  if (consumptions.length === 0) return { lines: [], totalApplied: 0 };

  const totalApplied = consumptions.reduce((s, c) => s + c.applied, 0);

  // Atomic: the per-grant `remaining` decrements AND the balanced ledger debit
  // commit-or-roll-back together (postTransaction nests as a savepoint on the
  // open `tx`), so `credit_grants.remaining` can never drift from the
  // `customer_credit` materialized balance — a crash between them rolls back both.
  await txDb.transaction(async (tx) => {
    for (const c of consumptions) {
      await tx
        .update(creditGrantsTable)
        .set({ remaining: sql`${creditGrantsTable.remaining} - ${c.applied}` })
        .where(eq(creditGrantsTable.id, c.grantId));
    }

    const creditAccount = await ensureAccount(tx, ctx, {
      key: customerCreditAccountKey(input.customerRef),
      kind: 'liability',
    });
    const revenue = await ensureAccount(tx, ctx, { key: 'platform_revenue', kind: 'revenue' });
    await postTransaction(tx, ctx, {
      kind: 'adjustment',
      memo: `apply credit ${input.customerRef}`,
      entries: [
        { accountId: creditAccount.id, direction: 'debit', amount: totalApplied },
        { accountId: revenue.id, direction: 'credit', amount: totalApplied },
      ],
    });
  });

  const lines: CreditLine[] = consumptions.map((c) => ({
    kind: 'credit',
    description: 'Applied account credit',
    amount: -c.applied,
    sourceReference: c.grantReference,
  }));
  return { lines, totalApplied };
}
