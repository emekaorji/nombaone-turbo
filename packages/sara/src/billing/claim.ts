import { eq } from 'drizzle-orm';

import { subscriptionPeriodsTable, type SubscriptionPeriodRow } from '@nombaone/core-db/schema';

import type { DomainContext, InfraTxDb } from '../context';

export interface ClaimPeriodInput {
  subscriptionId: string;
  periodIndex: number;
  start: Date;
  end: Date;
  invoiceId?: string;
}

export interface PeriodClaim {
  /** false ⇒ this period was already claimed (replay / second worker) — the caller
   *  must do NOTHING further: no invoice, no charge (B6/B8/K2/K4). */
  claimed: boolean;
  period?: SubscriptionPeriodRow;
}

/**
 * Atomically CLAIM billing period N (D.1): `INSERT … ON CONFLICT (subscription_id,
 * period_index) DO NOTHING RETURNING`. The `unique(subscription_id, period_index)`
 * index is the STRUCTURAL double-bill guard — exactly one caller wins, regardless
 * of advisory locks, connection pools, or replays. A lost claim returns
 * `claimed:false` and the sweep skips the subscription this tick.
 */
export async function claimPeriod(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ClaimPeriodInput
): Promise<PeriodClaim> {
  const [row] = await txDb
    .insert(subscriptionPeriodsTable)
    .values({
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      subscriptionId: input.subscriptionId,
      periodIndex: input.periodIndex,
      periodStart: input.start,
      periodEnd: input.end,
      invoiceId: input.invoiceId ?? null,
    })
    .onConflictDoNothing({
      target: [subscriptionPeriodsTable.subscriptionId, subscriptionPeriodsTable.periodIndex],
    })
    .returning();
  return row ? { claimed: true, period: row } : { claimed: false };
}

/** Link the finalized invoice onto a claimed period (run in the same sweep tx). */
export async function linkPeriodInvoice(
  txDb: InfraTxDb,
  periodId: string,
  invoiceId: string
): Promise<void> {
  await txDb
    .update(subscriptionPeriodsTable)
    .set({ invoiceId })
    .where(eq(subscriptionPeriodsTable.id, periodId));
}
