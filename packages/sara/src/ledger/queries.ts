import { ledgerTransactionsTable, type LedgerTransactionRow } from '@nombaone/core-db/schema';
import { and, desc, eq, lt, or } from 'drizzle-orm';

import type { DomainContext, InfraDb } from '../context';
import { buildPage, clampLimit, decodeCursor, type Page } from '../pagination';

export interface ListTransactionsOptions {
  limit?: number;
  cursor?: string;
}

/**
 * ── Keyset-paginated transaction history ──
 *
 * Reads are ALWAYS scoped to the caller's (org, environment) — the handler never
 * passes a client-supplied tenant. We page by keyset on `(created_at desc, id
 * desc)`, matching the table's `keyset` index: fetch `limit + 1` rows, slice to
 * `limit`, and emit an opaque cursor for the next page. No COUNT(*), no OFFSET —
 * stable and O(page) regardless of table size.
 */
export async function listTransactions(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListTransactionsOptions = {}
): Promise<Page<LedgerTransactionRow>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const tenantScope = and(
    eq(ledgerTransactionsTable.organizationId, ctx.organizationId),
    eq(ledgerTransactionsTable.environment, ctx.environment)
  );

  // Strict keyset predicate: rows strictly "after" the cursor in (createdAt,id)
  // descending order — older createdAt, or same createdAt with a smaller id.
  const keyset = cursor
    ? or(
        lt(ledgerTransactionsTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(ledgerTransactionsTable.createdAt, new Date(cursor.createdAt)),
          lt(ledgerTransactionsTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select()
    .from(ledgerTransactionsTable)
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(ledgerTransactionsTable.createdAt), desc(ledgerTransactionsTable.id))
    .limit(limit + 1);

  return buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
  }));
}
