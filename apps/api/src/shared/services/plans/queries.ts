import { and, desc, eq, lt, or } from 'drizzle-orm';

import { plansTable, type PlanRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';
import { serializePlan } from './serialize';

import type { DomainContext, InfraDb } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
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
