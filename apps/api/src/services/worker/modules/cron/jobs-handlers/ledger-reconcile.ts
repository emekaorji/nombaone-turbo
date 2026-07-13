import { and, eq, sql } from 'drizzle-orm';

import { ledgerAccountsTable, organizationsTable } from '@nombaone/core-db/schema';

import { db } from '@shared/config/db';
import { logger } from '@shared/observability/logger';
import { reconcileLedger } from '@shared/services/reconciliation';

import type { DomainContext, Mode } from '@nombaone/sara/context';

export interface LedgerReconcileResult {
  orgsChecked: number;
  unbalanced: number;
  suspenseDrift: number;
  negativeTenantBalances: number;
}

/**
 * THE NIGHTLY LEDGER AUDIT — the only thing that would ever TELL US a money bug shipped.
 *
 * Everything else in the money path is a guard that assumes the code is right. This is
 * the check that assumes it is wrong. Both of the bugs found on 2026-07-13 —
 * `confirmInvoiceFromWebhook` never settling, and settlement being gated on a row no
 * merchant could obtain — were invisible for exactly one reason: the entire gross piled
 * up in `platform_revenue` and nobody was looking at it. Invariant 2 below is a
 * one-number alarm for that whole failure class.
 *
 * Three invariants, per (organization, mode):
 *
 *  1. ZERO-SUM. Σ debits = Σ credits across every entry. A double-entry ledger that does
 *     not balance is not a ledger. (`assertBalanced` guards each write; this catches
 *     anything that got past it.)
 *
 *  2. 🔴 SUSPENSE-ZERO. `platform_revenue` must be **exactly 0**.
 *     A charge credits the full gross into `platform_revenue`; settlement then debits the
 *     whole gross back out, splitting it into `platform_fees` (ours) and
 *     `tenant_settlement:{ref}` (the merchant's). So a non-zero balance here means naira
 *     was COLLECTED AND ATTRIBUTED TO NOBODY — money in our account that no merchant can
 *     see and no report will show. This is the alarm that would have fired on day one.
 *
 *  3. NO NEGATIVE TENANT BALANCE. We can never owe a merchant a negative amount. There
 *     is a DB CHECK enforcing this structurally, so a hit here means the constraint was
 *     dropped or bypassed — which is worth screaming about.
 *
 * Drift does NOT halt billing. Stopping the money path because the books look odd would
 * turn an accounting discrepancy into an outage. It logs at `error` with the org, so it
 * pages a human and is greppable.
 */
export async function handleLedgerReconcile(): Promise<LedgerReconcileResult> {
  const result: LedgerReconcileResult = {
    orgsChecked: 0,
    unbalanced: 0,
    suspenseDrift: 0,
    negativeTenantBalances: 0,
  };

  for (const mode of ['sandbox', 'live'] as Mode[]) {
    // Only organizations that have ever touched the ledger.
    const orgs = await db
      .selectDistinct({
        organizationId: ledgerAccountsTable.organizationId,
        reference: organizationsTable.reference,
      })
      .from(ledgerAccountsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, ledgerAccountsTable.organizationId))
      .where(eq(ledgerAccountsTable.mode, mode));

    for (const org of orgs) {
      result.orgsChecked += 1;
      const ctx: DomainContext = { organizationId: org.organizationId, mode };

      // ── 1. zero-sum
      const report = await reconcileLedger(db, ctx);
      if (!report.balanced) {
        result.unbalanced += 1;
        logger.error('[ledger-reconcile] LEDGER DOES NOT BALANCE', {
          organizationId: org.organizationId,
          organization: org.reference,
          mode,
          drift: report.drift,
          totalDebits: report.totalDebits,
          totalCredits: report.totalCredits,
        });
      }

      // ── 2. suspense-zero — money collected but attributed to nobody
      const [suspense] = await db
        .select({ balance: ledgerAccountsTable.balance })
        .from(ledgerAccountsTable)
        .where(
          and(
            eq(ledgerAccountsTable.organizationId, org.organizationId),
            eq(ledgerAccountsTable.mode, mode),
            eq(ledgerAccountsTable.key, 'platform_revenue')
          )
        )
        .limit(1);

      const stranded = suspense?.balance ?? 0;
      if (stranded !== 0) {
        result.suspenseDrift += 1;
        logger.error('[ledger-reconcile] UNATTRIBUTED MONEY in platform_revenue', {
          organizationId: org.organizationId,
          organization: org.reference,
          mode,
          strandedKobo: stranded,
          meaning:
            'money was collected and never split into platform_fees + tenant_settlement — a merchant is not seeing revenue they earned',
        });
      }

      // ── 3. no merchant is owed a negative amount
      const negatives = await db
        .select({ key: ledgerAccountsTable.key, balance: ledgerAccountsTable.balance })
        .from(ledgerAccountsTable)
        .where(
          and(
            eq(ledgerAccountsTable.organizationId, org.organizationId),
            eq(ledgerAccountsTable.mode, mode),
            sql`${ledgerAccountsTable.key} LIKE 'tenant_settlement:%'`,
            sql`${ledgerAccountsTable.balance} < 0`
          )
        );

      for (const acct of negatives) {
        result.negativeTenantBalances += 1;
        logger.error('[ledger-reconcile] NEGATIVE TENANT BALANCE (the DB CHECK should make this impossible)', {
          organizationId: org.organizationId,
          mode,
          account: acct.key,
          balanceKobo: acct.balance,
        });
      }
    }
  }

  const healthy =
    result.unbalanced === 0 && result.suspenseDrift === 0 && result.negativeTenantBalances === 0;

  if (healthy) {
    logger.info('[ledger-reconcile] books are clean', { ...result });
  } else {
    logger.error('[ledger-reconcile] DRIFT DETECTED — a human should look at this now', {
      ...result,
    });
  }

  return result;
}
