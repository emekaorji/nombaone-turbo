import { and, desc, eq, lt, or } from 'drizzle-orm';

import { plansTable, pricesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { resolvePlanId } from '../plans/queries';
import { serializePrice } from './serialize';

import type { DomainContext, InfraDb } from '../context';
import type { Page } from '../pagination';
import type { ListPricesOptions, PriceResponseData } from './types';

/**
 * Reads join `prices` → `plans` to emit the plan's public **reference** (never its
 * UUID), and resolve by reference within the caller's pinned scope.
 */

/** Resolve one price by its public reference within the caller's scope. */
export async function getPriceByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<PriceResponseData> {
  const [found] = await db
    .select({ price: pricesTable, planRef: plansTable.reference })
    .from(pricesTable)
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.reference, reference)
      )
    )
    .limit(1);

  if (!found) {
    throw AppError.NotFound('price not found', { reference }, NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND);
  }

  return serializePrice(found.price, found.planRef);
}

/** Keyset-paginated list, optionally filtered by `planRef` and/or `active`. */
export async function listPrices(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListPricesOptions = {}
): Promise<Page<PriceResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  // Resolve a plan reference (if given) to its UUID within scope — also enforces
  // isolation: a plan not in this caller's scope throws PLAN_NOT_FOUND.
  const planId = opts.planRef ? (await resolvePlanId(db, ctx, opts.planRef)).id : undefined;

  const tenantScope = and(
    eq(pricesTable.organizationId, ctx.organizationId),
    eq(pricesTable.mode, ctx.mode),
    planId ? eq(pricesTable.planId, planId) : undefined,
    opts.active !== undefined ? eq(pricesTable.active, opts.active) : undefined
  );

  const keyset = cursor
    ? or(
        lt(pricesTable.createdAt, new Date(cursor.createdAt)),
        and(eq(pricesTable.createdAt, new Date(cursor.createdAt)), lt(pricesTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select({ price: pricesTable, planRef: plansTable.reference })
    .from(pricesTable)
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(pricesTable.createdAt), desc(pricesTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.price.createdAt).toISOString(),
    id: row.price.id,
  }));

  return {
    ...page,
    data: page.data.map((row) => serializePrice(row.price, row.planRef)),
  };
}

/** The `/v1/plans/:ref/prices` read: every price under one plan, within scope. */
export async function listPricesForPlan(
  db: InfraDb,
  ctx: DomainContext,
  planRef: string,
  opts: Omit<ListPricesOptions, 'planRef'> = {}
): Promise<Page<PriceResponseData>> {
  return listPrices(db, ctx, { ...opts, planRef });
}
