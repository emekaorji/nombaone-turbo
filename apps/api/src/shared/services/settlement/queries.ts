import { and, desc, eq, lt, or } from 'drizzle-orm';

import { invoicesTable, settlementsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';

import { serializeSettlement } from './serialize';

import type { DomainContext, InfraDb } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
import type { SettlementResponseData, SettlementStatus } from '@nombaone/core-contracts/types';

export interface ListSettlementsOptions {
  limit?: number;
  cursor?: string;
  status?: SettlementStatus;
}

export async function listSettlements(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListSettlementsOptions = {}
): Promise<Page<SettlementResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const scope = and(
    eq(settlementsTable.organizationId, ctx.organizationId),
    eq(settlementsTable.mode, ctx.mode),
    opts.status ? eq(settlementsTable.status, opts.status) : undefined
  );
  const keyset = cursor
    ? or(
        lt(settlementsTable.createdAt, new Date(cursor.createdAt)),
        and(eq(settlementsTable.createdAt, new Date(cursor.createdAt)), lt(settlementsTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select({ settlement: settlementsTable, invoiceRef: invoicesTable.reference })
    .from(settlementsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, settlementsTable.invoiceId))
    .where(keyset ? and(scope, keyset) : scope)
    .orderBy(desc(settlementsTable.createdAt), desc(settlementsTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (r) => ({
    createdAt: r.settlement.createdAt.toISOString(),
    id: r.settlement.id,
  }));
  return {
    ...page,
    data: page.data.map((r) => serializeSettlement(r.settlement, r.invoiceRef)),
  };
}

export async function getSettlementByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<SettlementResponseData> {
  const [row] = await db
    .select({ settlement: settlementsTable, invoiceRef: invoicesTable.reference })
    .from(settlementsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, settlementsTable.invoiceId))
    .where(
      and(
        eq(settlementsTable.reference, reference),
        eq(settlementsTable.organizationId, ctx.organizationId),
        eq(settlementsTable.mode, ctx.mode)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound(
      'settlement not found',
      { reference },
      NOMBAONE_ERROR_CODES.SETTLEMENT_NOT_FOUND
    );
  }
  return serializeSettlement(row.settlement, row.invoiceRef);
}
