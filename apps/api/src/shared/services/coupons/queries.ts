import { and, desc, eq, lt, or } from 'drizzle-orm';

import { couponsTable, type CouponRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';
import { serializeCoupon } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
import type { CouponResponseData, ListCouponsOptions } from './types';

/** Load a coupon row by its public reference within scope. */
export async function loadCouponRow(
  scope: InfraReadScope,
  ctx: DomainContext,
  reference: string
): Promise<CouponRow> {
  const [row] = await scope
    .select()
    .from(couponsTable)
    .where(
      and(
        eq(couponsTable.organizationId, ctx.organizationId),
        eq(couponsTable.mode, ctx.mode),
        eq(couponsTable.reference, reference)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound('coupon not found', { reference }, NOMBAONE_ERROR_CODES.COUPON_NOT_FOUND);
  }
  return row;
}

/** Resolve a coupon by its reference OR its tenant-facing code (for apply). */
export async function getCouponByReferenceOrCode(
  scope: InfraReadScope,
  ctx: DomainContext,
  refOrCode: string
): Promise<CouponRow> {
  const [row] = await scope
    .select()
    .from(couponsTable)
    .where(
      and(
        eq(couponsTable.organizationId, ctx.organizationId),
        eq(couponsTable.mode, ctx.mode),
        or(eq(couponsTable.reference, refOrCode), eq(couponsTable.code, refOrCode))
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound('coupon not found', { coupon: refOrCode }, NOMBAONE_ERROR_CODES.COUPON_NOT_FOUND);
  }
  return row;
}

export async function getCouponByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<CouponResponseData> {
  return serializeCoupon(await loadCouponRow(db, ctx, reference));
}

export async function listCoupons(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListCouponsOptions = {}
): Promise<Page<CouponResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const tenantScope = and(
    eq(couponsTable.organizationId, ctx.organizationId),
    eq(couponsTable.mode, ctx.mode)
  );
  const keyset = cursor
    ? or(
        lt(couponsTable.createdAt, new Date(cursor.createdAt)),
        and(eq(couponsTable.createdAt, new Date(cursor.createdAt)), lt(couponsTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select()
    .from(couponsTable)
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(couponsTable.createdAt), desc(couponsTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
  }));
  return { ...page, data: page.data.map(serializeCoupon) };
}
