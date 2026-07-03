import { and, eq, sql } from 'drizzle-orm';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { ledgerEntriesTable, ledgerTransactionsTable } from '@nombaone/core-db/schema';

import type { DomainContext, InfraDb } from '../context';

/**
 * ── Zero-sum reconciliation paradigm ──
 *
 * A correct double-entry ledger sums to zero: across ALL entries, total debits
 * must equal total credits. `assertBalanced` guards this per-transaction at write
 * time; reconciliation is the periodic, ledger-wide cross-check that the system
 * as a whole still balances — catching any drift that a bug, partial failure, or
 * out-of-band write might have introduced, and independently validating that the
 * materialized account balances were maintained honestly.
 *
 * We compute totals by summing the entry ledger directly (the authoritative
 * source), scoped to the caller's (org, environment) via a join to the
 * transaction header. `drift = totalDebits − totalCredits`; a healthy ledger has
 * `drift === 0`.
 */
export interface ReconciliationReport {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  /** totalDebits − totalCredits; 0 when the ledger balances. */
  drift: number;
}

export async function reconcileLedger(
  db: InfraDb,
  ctx: DomainContext
): Promise<ReconciliationReport> {
  const [totals] = await db
    .select({
      totalDebits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'debit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
      totalCredits: sql<number>`coalesce(sum(case when ${ledgerEntriesTable.direction} = 'credit' then ${ledgerEntriesTable.amount} else 0 end), 0)`,
    })
    .from(ledgerEntriesTable)
    .innerJoin(
      ledgerTransactionsTable,
      eq(ledgerEntriesTable.transactionId, ledgerTransactionsTable.id)
    )
    .where(
      and(
        eq(ledgerTransactionsTable.organizationId, ctx.organizationId),
        eq(ledgerTransactionsTable.environment, ctx.environment)
      )
    );

  // SUM over bigint columns can come back as a numeric string from the driver;
  // normalize to a JS number (safe — these are kobo totals well within 2^53).
  const totalDebits = Number(totals?.totalDebits ?? 0);
  const totalCredits = Number(totals?.totalCredits ?? 0);
  const drift = totalDebits - totalCredits;

  return {
    balanced: drift === 0,
    totalDebits,
    totalCredits,
    drift,
  };
}

/**
 * Assert the ledger is within an acceptable drift band, else throw
 * `RECONCILIATION_DRIFT_DETECTED`. The band defaults to 0 (exact zero-sum
 * required); a deployment may permit a tiny tolerance (e.g. from rounding in an
 * upstream system) by passing `driftBandKobo`. Pure — feed it the totals from
 * `reconcileLedger`.
 */
export function assertZeroSum(
  totalDebits: number,
  totalCredits: number,
  driftBandKobo = 0
): void {
  const drift = totalDebits - totalCredits;
  if (Math.abs(drift) > driftBandKobo) {
    throw AppError.InternalServerError(
      'ledger reconciliation drift detected',
      { totalDebits, totalCredits, drift, driftBandKobo },
      NOMBAONE_ERROR_CODES.RECONCILIATION_DRIFT_DETECTED
    );
  }
}
