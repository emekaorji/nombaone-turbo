import { and, eq, gt, sql } from 'drizzle-orm';

import { ledgerAccountsTable, organizationsTable } from '@nombaone/core-db/schema';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { getNombaClient } from '@shared/config/nomba';
import { logger } from '@shared/observability/logger';
import {
  findDefaultPayoutAccount,
  getAvailableForPayout,
  payoutToTenant,
} from '@shared/services/settlement';

import type { DomainContext, Mode } from '@nombaone/sara/context';

export interface SettlementSweepResult {
  scanned: number;
  paid: number;
  skippedNoAccount: number;
  skippedBelowMinimum: number;
  failed: number;
}

/**
 * THE DAILY SETTLEMENT SWEEP — merchants get their money without asking.
 *
 * One payout per merchant per day, for their whole available balance. Runs at 07:00
 * Africa/Lagos so the money is in their bank before the business day starts.
 *
 * ── Why daily and not per-payment ───────────────────────────────────────────────
 * Sweeping on every `payment_success` sounds better and is worse, for the merchant:
 *   • Nomba's NIP fee is FLAT (₦10/₦25/₦50 by tier). Per-payment, a ₦1,000
 *     subscription loses 1% to the payout leg and a ₦200 one loses 5% — the fee is
 *     regressive, hitting the cheapest plans hardest. Batched daily, one fee covers
 *     every renewal that day: ~0.26% on the same ₦1,000 plan, and it keeps falling
 *     with volume.
 *   • Nomba caps transfers at 5/min per recipient. Calendar renewals all fire in the
 *     same 02:00 minute, so a merchant with a few hundred subscribers would have most
 *     of their payouts rejected — instant sweeping would fail by NOT DELIVERING the
 *     money, which is the exact thing it was supposed to guarantee.
 * A merchant who wants it sooner presses "Pay me now" (`POST /v1/settlements/payout`),
 * which runs through this same `payoutToTenant` — there is no second payout path.
 *
 * ── Idempotency ────────────────────────────────────────────────────────────────
 * `merchantTxRef = SWP:{orgRef}:{mode}:{lagosDate}` is DETERMINISTIC. A replayed tick,
 * a duplicated BullMQ job, or a redeploy mid-sweep all recompute the same key, lose the
 * `unique(payouts.merchant_tx_ref)` claim, and pay nothing. It is also Nomba's own
 * idempotency key, so even a retried HTTP call cannot send the money twice.
 *
 * A "Pay me now" racing this sweep is safe for a different reason: both take a
 * `FOR UPDATE` lock on the merchant's `tenant_settlement` ledger row and re-derive the
 * available balance under it, so the loser sees the winner's debit.
 */
export async function handleSettlementSweep(): Promise<SettlementSweepResult> {
  const result: SettlementSweepResult = {
    scanned: 0,
    paid: 0,
    skippedNoAccount: 0,
    skippedBelowMinimum: 0,
    failed: 0,
  };

  const today = lagosDate(new Date());

  for (const mode of ['sandbox', 'live'] as Mode[]) {
    // Only orgs that actually hold money — a positive `tenant_settlement:%` balance.
    // Scanning every organization instead would be one wasted round-trip per merchant
    // who has never sold anything.
    const owed = await db
      .select({
        organizationId: ledgerAccountsTable.organizationId,
        balance: ledgerAccountsTable.balance,
        orgReference: organizationsTable.reference,
      })
      .from(ledgerAccountsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, ledgerAccountsTable.organizationId))
      .where(
        and(
          eq(ledgerAccountsTable.mode, mode),
          gt(ledgerAccountsTable.balance, 0),
          sql`${ledgerAccountsTable.key} LIKE 'tenant_settlement:%'`
        )
      );

    for (const row of owed) {
      result.scanned += 1;
      const ctx: DomainContext = { organizationId: row.organizationId, mode };

      try {
        // No bank account yet ⇒ nothing to sweep to. Their balance simply waits; it is
        // never lost, and the console nags them to add one.
        const destination = await findDefaultPayoutAccount(db, ctx);
        if (!destination) {
          result.skippedNoAccount += 1;
          continue;
        }

        // Respect the escrow hold + the tenant's minimum.
        const { availableKobo } = await getAvailableForPayout(db, ctx);
        if (availableKobo <= 0) {
          result.skippedBelowMinimum += 1;
          continue;
        }

        await payoutToTenant(db, ctx, {
          amountKobo: availableKobo,
          merchantTxRef: `SWP:${row.orgReference}:${mode}:${today}`,
          client: getNombaClient(mode),
          payoutEnabled: env.NOMBA_PAYOUT_ENABLED,
        });
        result.paid += 1;
      } catch (error) {
        // One merchant's failure must never stop the others being paid.
        result.failed += 1;
        logger.error('[settlement-sweep] payout failed', {
          organizationId: row.organizationId,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  logger.info('[settlement-sweep] done', { ...result });
  return result;
}

/**
 * The Lagos calendar date (`YYYY-MM-DD`) — the day-bucket the idempotency key is built
 * on. It must be LAGOS, not UTC: Nigeria is UTC+1, so a UTC date would roll over at
 * 01:00 local and a 07:00 Lagos sweep would sit on the wrong side of the boundary for
 * an hour every night — which is exactly the kind of seam that pays a merchant twice.
 */
function lagosDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA gives ISO-ordered YYYY-MM-DD
}
