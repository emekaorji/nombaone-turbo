import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  ledgerEntriesTable,
  ledgerTransactionsTable,
  ledgerAccountsTable,
} from '@nombaone/core-db/schema';
import { eq, sql } from 'drizzle-orm';

import type { DomainContext, InfraTxDb } from '../context';
import { mintReference } from '../reference';

/**
 * ── The double-entry posting paradigm ──
 *
 * Every money movement is recorded as ONE immutable transaction composed of ≥2
 * entries (legs). The cardinal invariant — Σ(debits) = Σ(credits) — is asserted
 * in pure code BEFORE any row is written, so an unbalanced posting can never
 * reach the database. Amounts are always positive integer kobo; the DIRECTION
 * carries the sign. There are no floats and no negative amounts anywhere on the
 * money path.
 *
 * Balance is a MATERIALIZED counter on each account, mutated atomically in the
 * SAME interactive transaction that writes the entries. The sign convention is
 * fixed and applied uniformly to every account kind: a CREDIT adds `+amount`,
 * a DEBIT adds `-amount`. (This is a deliberate, consistent choice for the
 * boilerplate; asset/expense accounts will therefore carry a "naturally
 * negative" balance under this convention — your product layer decides how to
 * present them. What matters is that it is uniform, so the ledger as a whole
 * always sums to zero.)
 *
 * Atomicity is non-negotiable: the transaction header, all entries, and all
 * balance updates either commit together or not at all. We open the interactive
 * transaction here off the passed pooled handle.
 */

/** One leg of a posting: which account, which side, how much (positive kobo). */
export interface EntryInput {
  accountId: string;
  direction: 'debit' | 'credit';
  amount: number;
}

export type LedgerTransactionKind =
  | 'charge'
  | 'reversal'
  | 'adjustment'
  | 'settlement'
  | 'fee';

export interface PostTransactionInput {
  kind: LedgerTransactionKind;
  memo?: string;
  entries: EntryInput[];
}

export interface PostedTransaction {
  transactionId: string;
  reference: string;
}

/**
 * The guardian of the cardinal invariant. Throws `LEDGER_TRANSACTION_UNBALANCED`
 * unless there are ≥2 entries, every amount is a positive integer, and the debit
 * total equals the credit total. Pure — call it anywhere, it touches no I/O.
 */
export function assertBalanced(entries: EntryInput[]): void {
  if (entries.length < 2) {
    throw AppError.UnprocessableEntity(
      'a balanced transaction requires at least two entries',
      { entryCount: entries.length },
      NOMBAONE_ERROR_CODES.LEDGER_TRANSACTION_UNBALANCED
    );
  }

  let debitTotal = 0;
  let creditTotal = 0;

  for (const entry of entries) {
    if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
      throw AppError.UnprocessableEntity(
        'entry amount must be a positive integer (kobo)',
        { accountId: entry.accountId, amount: entry.amount },
        NOMBAONE_ERROR_CODES.LEDGER_INVALID_ENTRY
      );
    }

    if (entry.direction === 'debit') {
      debitTotal += entry.amount;
    } else {
      creditTotal += entry.amount;
    }
  }

  if (debitTotal !== creditTotal) {
    throw AppError.UnprocessableEntity(
      'transaction does not balance: Σdebits must equal Σcredits',
      { debitTotal, creditTotal },
      NOMBAONE_ERROR_CODES.LEDGER_TRANSACTION_UNBALANCED
    );
  }
}

/** Uniform balance delta: credit adds +amount, debit adds -amount. */
export const balanceDelta = (entry: EntryInput): number =>
  entry.direction === 'credit' ? entry.amount : -entry.amount;

/**
 * Post a balanced double-entry transaction atomically. Asserts the invariant,
 * inserts the transaction header + every entry, and folds each leg's signed
 * delta into the owning account's materialized balance — all inside one
 * interactive transaction. Returns the new transaction's internal id and public
 * reference.
 */
export async function postTransaction(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: PostTransactionInput
): Promise<PostedTransaction> {
  assertBalanced(input.entries);

  return txDb.transaction(async (tx) => {
    const reference = mintReference('LTX');

    const [transaction] = await tx
      .insert(ledgerTransactionsTable)
      .values({
        reference,
        organizationId: ctx.organizationId,
        environment: ctx.environment,
        kind: input.kind,
        memo: input.memo ?? null,
      })
      .returning({ id: ledgerTransactionsTable.id });

    if (!transaction) {
      throw AppError.InternalServerError(
        'failed to insert ledger transaction',
        undefined,
        NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
      );
    }

    await tx.insert(ledgerEntriesTable).values(
      input.entries.map((entry) => ({
        transactionId: transaction.id,
        accountId: entry.accountId,
        direction: entry.direction,
        amount: entry.amount,
      }))
    );

    // Fold each signed delta into its account's materialized balance. Sequential
    // (not parallel) so all updates share the one transaction's connection.
    for (const entry of input.entries) {
      await tx
        .update(ledgerAccountsTable)
        .set({ balance: sql`${ledgerAccountsTable.balance} + ${balanceDelta(entry)}` })
        .where(eq(ledgerAccountsTable.id, entry.accountId));
    }

    return { transactionId: transaction.id, reference };
  });
}
