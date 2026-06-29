import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { ledgerAccountsTable } from '@nombaone/core-db/schema';
import { eq } from 'drizzle-orm';

import type { InfraDb } from '../context';

/**
 * ── O(1) balance reads ──
 *
 * Because every posting folds its signed deltas into the account's materialized
 * `balance` column inside the same atomic transaction, the current balance is a
 * single-row read — we never sum the entry ledger at read time. (Reconciliation,
 * which DOES sum entries, is the periodic cross-check that the materialized
 * counters have not drifted.)
 *
 * This reads by internal account id and is not ctx-scoped: callers resolve the
 * account through `ensureAccount` / `queries` (which ARE ctx-scoped) and pass a
 * trusted id. An unknown id is a programmer error, surfaced as
 * `LEDGER_ACCOUNT_NOT_FOUND`.
 */
export async function getAccountBalance(db: InfraDb, accountId: string): Promise<number> {
  const [account] = await db
    .select({ balance: ledgerAccountsTable.balance })
    .from(ledgerAccountsTable)
    .where(eq(ledgerAccountsTable.id, accountId))
    .limit(1);

  if (!account) {
    throw AppError.NotFound(
      'ledger account not found',
      { accountId },
      NOMBAONE_ERROR_CODES.LEDGER_ACCOUNT_NOT_FOUND
    );
  }

  return account.balance;
}
