import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  ledgerEntriesTable,
  ledgerTransactionsTable,
  ledgerAccountsTable,
} from '@nombaone/core-db/schema';
import { and, eq, sql } from 'drizzle-orm';

import type { DomainContext, InfraTxDb } from '../context';
import { mintReference } from '../reference';
import { balanceDelta, type EntryInput, type PostedTransaction } from './post';

/**
 * ── Correction-by-reversal paradigm ──
 *
 * A posted transaction is a FACT: it is never edited or deleted. To undo it we
 * write a NEW transaction of kind `reversal` whose entries are the originals
 * with their directions flipped (debit↔credit), linked back via
 * `reverses_transaction_id`. Replaying both transactions nets every touched
 * account to where it started, and the audit trail records exactly what happened
 * and when.
 *
 * Reversal is idempotent-by-guard: a transaction may be reversed at most once.
 * We detect a prior reversal by the presence of a `reversal` row pointing at the
 * target and throw `LEDGER_TRANSACTION_ALREADY_REVERSED`. The original lookup is
 * scoped by ctx (org + environment) — you can only reverse your own tenant's
 * transactions in the current environment.
 */
export async function reverseTransaction(
  txDb: InfraTxDb,
  ctx: DomainContext,
  transactionId: string
): Promise<PostedTransaction> {
  return txDb.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(ledgerTransactionsTable)
      .where(
        and(
          eq(ledgerTransactionsTable.id, transactionId),
          eq(ledgerTransactionsTable.organizationId, ctx.organizationId),
          eq(ledgerTransactionsTable.environment, ctx.environment)
        )
      )
      .limit(1);

    if (!original) {
      throw AppError.NotFound(
        'ledger transaction not found',
        { transactionId },
        NOMBAONE_ERROR_CODES.LEDGER_TRANSACTION_NOT_FOUND
      );
    }

    const [existingReversal] = await tx
      .select({ id: ledgerTransactionsTable.id })
      .from(ledgerTransactionsTable)
      .where(eq(ledgerTransactionsTable.reversesTransactionId, transactionId))
      .limit(1);

    if (existingReversal) {
      throw AppError.Conflict(
        'ledger transaction has already been reversed',
        { transactionId, reversalId: existingReversal.id },
        NOMBAONE_ERROR_CODES.LEDGER_TRANSACTION_ALREADY_REVERSED
      );
    }

    const originalEntries = await tx
      .select({
        accountId: ledgerEntriesTable.accountId,
        direction: ledgerEntriesTable.direction,
        amount: ledgerEntriesTable.amount,
      })
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.transactionId, transactionId));

    if (originalEntries.length === 0) {
      throw AppError.UnprocessableEntity(
        'ledger transaction has no entries to reverse',
        { transactionId },
        NOMBAONE_ERROR_CODES.LEDGER_INVALID_ENTRY
      );
    }

    // Flip every leg: a debit becomes a credit and vice versa. The flipped set is
    // balanced by construction (it is the original set with sides swapped).
    const flipped: EntryInput[] = originalEntries.map((entry) => ({
      accountId: entry.accountId,
      direction: entry.direction === 'debit' ? 'credit' : 'debit',
      amount: entry.amount,
    }));

    const reference = mintReference('LTX');

    const [reversal] = await tx
      .insert(ledgerTransactionsTable)
      .values({
        reference,
        organizationId: ctx.organizationId,
        environment: ctx.environment,
        kind: 'reversal',
        reversesTransactionId: transactionId,
        memo: `reversal of ${original.reference}`,
      })
      .returning({ id: ledgerTransactionsTable.id });

    if (!reversal) {
      throw AppError.InternalServerError(
        'failed to insert reversal transaction',
        undefined,
        NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
      );
    }

    await tx.insert(ledgerEntriesTable).values(
      flipped.map((entry) => ({
        transactionId: reversal.id,
        accountId: entry.accountId,
        direction: entry.direction,
        amount: entry.amount,
      }))
    );

    for (const entry of flipped) {
      await tx
        .update(ledgerAccountsTable)
        .set({ balance: sql`${ledgerAccountsTable.balance} + ${balanceDelta(entry)}` })
        .where(eq(ledgerAccountsTable.id, entry.accountId));
    }

    return { transactionId: reversal.id, reference };
  });
}
