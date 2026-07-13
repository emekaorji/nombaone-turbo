import { and, desc, eq, lt, or } from 'drizzle-orm';

import { plansTable, pricesTable, type PlanRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';
import { serializePrice } from '../prices/serialize';
import { serializePlan } from './serialize';

import type { DomainContext, InfraDb } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
import type { PriceResponseData } from '../prices/types';
import type { ListPlansOptions, PlanResponseData } from './types';

/** Resolve one plan by its public reference within the caller's scope. */
export async function getPlanByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<PlanResponseData> {
  const { row } = await resolvePlanId(db, ctx, reference);
  return serializePlan(row);
}

/**
 * What the plan costs RIGHT NOW: its ACTIVE prices, newest first.
 *
 * The answer to "what can someone subscribe to today", which is what a plan's `prices` array
 * means on every write path (`POST /v1/plans`, `PATCH /v1/plans/{id}`). Retired prices are
 * deliberately absent — they still exist, still bill the subscribers pinned to them, and are
 * still readable at `GET /v1/plans/{id}/prices`, but they are not on offer.
 *
 * Takes the plan ID (not the reference) because every caller has already resolved it — and
 * doing so is what proved the plan is in scope.
 */
export async function listActivePlanPrices(
  db: InfraDb,
  ctx: DomainContext,
  planId: string,
  planRef: string
): Promise<PriceResponseData[]> {
  const rows = await db
    .select()
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.planId, planId),
        eq(pricesTable.active, true)
      )
    )
    .orderBy(desc(pricesTable.createdAt));

  return rows.map((row) => serializePrice(row, planRef));
}

/** Keyset-paginated list, optionally filtered by `status`, within scope. */
export async function listPlans(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListPlansOptions = {}
): Promise<Page<PlanResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const tenantScope = and(
    eq(plansTable.organizationId, ctx.organizationId),
    eq(plansTable.mode, ctx.mode),
    opts.status ? eq(plansTable.status, opts.status) : undefined
  );

  const keyset = cursor
    ? or(
        lt(plansTable.createdAt, new Date(cursor.createdAt)),
        and(eq(plansTable.createdAt, new Date(cursor.createdAt)), lt(plansTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select()
    .from(plansTable)
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(plansTable.createdAt), desc(plansTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
  }));

  return { ...page, data: page.data.map(serializePlan) };
}

/**
 * Resolve a plan REFERENCE to its internal id + row, within the caller's scope —
 * the join key the prices module uses to turn a plan reference into its UUID
 * without leaking the UUID. Throws `PLAN_NOT_FOUND` if it isn't in scope (so a
 * cross-tenant reference simply does not exist here).
 */
export async function resolvePlanId(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<{ id: string; row: PlanRow }> {
  const [row] = await db
    .select()
    .from(plansTable)
    .where(
      and(
        eq(plansTable.organizationId, ctx.organizationId),
        eq(plansTable.mode, ctx.mode),
        eq(plansTable.reference, reference)
      )
    )
    .limit(1);

  if (!row) {
    throw AppError.NotFound(
      'plan not found',
      { reference },
      NOMBAONE_ERROR_CODES.PLAN_NOT_FOUND
    );
  }

  return { id: row.id, row };
}
