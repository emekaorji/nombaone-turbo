import { and, eq, gte, inArray, sql } from 'drizzle-orm';

import { settlementsTable } from '@nombaone/core-db/schema';

import { getOrgBillingSettings } from '@nombaone/sara/org';
import { getTenantSettlementBalance, resolveTenantSubAccount } from './accounts';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

export interface TenantEscrow {
  /** Σ net_to_tenant of the tenant's settlements inside the rolling lock window. */
  lockedKobo: number;
  /** The window start (ISO-8601). */
  since: string;
}

/**
 * The rolling escrow LOCK (F1/F3): the tenant may not withdraw funds collected in the
 * last `lockWindowHours` (default 3h), so we can claw back for a refund before they
 * drain. Only `net_to_tenant` is reserved (the platform fee is earned + non-refundable)
 * — precisely the refundable amount. Sums `net_to_tenant_kobo` over the tenant's own
 * `settled`/`reconciled` settlements newer than the cutoff (excludes `refunded`/`failed`/
 * `pending`, so an already-refunded settlement doesn't inflate the lock).
 */
export async function computeTenantEscrow(
  db: InfraReadScope,
  ctx: DomainContext,
  opts: { now?: Date; lockWindowHours?: number } = {}
): Promise<TenantEscrow> {
  const now = opts.now ?? new Date();
  const lockWindowHours = opts.lockWindowHours ?? 3;
  const since = new Date(now.getTime() - lockWindowHours * 3_600_000);
  const sub = await resolveTenantSubAccount(db, ctx);

  const [row] = await db
    .select({ locked: sql<number>`coalesce(sum(${settlementsTable.netToTenantKobo}), 0)` })
    .from(settlementsTable)
    .where(
      and(
        eq(settlementsTable.organizationId, ctx.organizationId),
        eq(settlementsTable.mode, ctx.mode),
        eq(settlementsTable.subAccountRef, sub.accountRef),
        gte(settlementsTable.createdAt, since),
        inArray(settlementsTable.status, ['settled', 'reconciled'])
      )
    );

  return { lockedKobo: Number(row?.locked ?? 0), since: since.toISOString() };
}

export interface PayoutAvailability {
  balanceKobo: number;
  lockedKobo: number;
  minWithdrawableKobo: number;
  availableKobo: number;
  since: string;
}

/**
 * What a tenant can withdraw right now: `available = balance − lockedLast3h − minBuffer`
 * (never negative). `balance` is the `tenant_settlement` ledger liability (apps/api's
 * authoritative view; the Nomba sub-account balance reconciles out-of-band). Both the
 * payout guard and `GET /v1/settlements/escrow` read this.
 */
export async function getAvailableForPayout(
  db: InfraReadScope,
  ctx: DomainContext,
  opts: { now?: Date; lockWindowHours?: number } = {}
): Promise<PayoutAvailability> {
  const balanceKobo = await getTenantSettlementBalance(db, ctx);
  const { lockedKobo, since } = await computeTenantEscrow(db, ctx, opts);
  const minWithdrawableKobo = (await getOrgBillingSettings(db, ctx)).minWithdrawableKobo ?? 0;
  const availableKobo = Math.max(0, balanceKobo - lockedKobo - minWithdrawableKobo);
  return { balanceKobo, lockedKobo, minWithdrawableKobo, availableKobo, since };
}
