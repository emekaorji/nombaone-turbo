import { and, desc, eq, lt, or } from 'drizzle-orm';

import { examplesTable, ledgerAccountsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { getAccountBalance } from '../ledger';
import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { serializeExample } from './serialize';

import type { DomainContext, InfraDb } from '../context';
import type { Page } from '../pagination';
import type { ExampleResponseData, ExampleStatus, ListExamplesOptions } from './types';

/**
 * ── Reads resolve by reference, server-side; status is derived from the ledger ──
 *
 * Two paradigms govern every read here:
 *
 *   • THE REFERENCE IS THE AUTHORITY, NOT THE ROUTE PARAM. A handler hands us the
 *     reference from the URL, but we re-resolve it against the caller's pinned
 *     (org, environment). We never trust a route param as proof of ownership;
 *     scope is enforced in the WHERE clause, so a reference from another tenant
 *     simply does not exist for this caller.
 *
 *   • STATUS IS DERIVED, NOT STORED. The `examples` table has no status column.
 *     We compute it from the ledger — the single source of truth for money state —
 *     so it can never drift from what actually happened to the money.
 *
 * Listing is keyset-paginated on `(created_at desc, id desc)` (matching the
 * table's `keyset` index): fetch `limit + 1`, slice, emit an opaque cursor. No
 * COUNT(*), no OFFSET.
 */

/** Resolve one example by its public reference within the caller's scope. */
export async function getExampleByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<ExampleResponseData> {
  const [row] = await db
    .select()
    .from(examplesTable)
    .where(
      and(
        eq(examplesTable.organizationId, ctx.organizationId),
        eq(examplesTable.mode, ctx.mode),
        eq(examplesTable.reference, reference)
      )
    )
    .limit(1);

  if (!row) {
    throw AppError.NotFound(
      'example not found',
      { reference },
      NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND
    );
  }

  const status = await deriveStatus(db, ctx);
  return serializeExample(row, status);
}

/** Keyset-paginated list, optionally filtered by `kind`, within scope. */
export async function listExamples(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListExamplesOptions = {}
): Promise<Page<ExampleResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const tenantScope = and(
    eq(examplesTable.organizationId, ctx.organizationId),
    eq(examplesTable.mode, ctx.mode),
    opts.kind ? eq(examplesTable.kind, opts.kind) : undefined
  );

  // Strict keyset predicate: rows strictly "after" the cursor in (createdAt, id)
  // descending order — older createdAt, or same createdAt with a smaller id.
  const keyset = cursor
    ? or(
        lt(examplesTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(examplesTable.createdAt, new Date(cursor.createdAt)),
          lt(examplesTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select()
    .from(examplesTable)
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(examplesTable.createdAt), desc(examplesTable.id))
    .limit(limit + 1);

  // Status is derived once per page from the tenant's ledger; the example slice
  // posts every charge against the shared `cash` account, so all rows on a page
  // share the same derived status. A real domain would derive per-resource.
  const status = await deriveStatus(db, ctx);

  // Page off the RAW rows so the keyset cursor encodes the real (createdAt, UUID
  // id) — the index columns — not the public reference. Serialize only the data.
  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
  }));

  return {
    ...page,
    data: page.data.map((row) => serializeExample(row, status)),
  };
}

/**
 * Derive status from the ledger for the caller's scope. Looks up the tenant's
 * `cash` account by key (ctx-scoped) and reads its O(1) materialized balance: a
 * non-zero balance means money has moved (collection succeeded → `settled`); no
 * `cash` account or a zero balance means `pending`. Demonstrates that status is
 * a function of the ledger, computed in one place and reused by both reads.
 */
async function deriveStatus(db: InfraDb, ctx: DomainContext): Promise<ExampleStatus> {
  const [cash] = await db
    .select({ id: ledgerAccountsTable.id })
    .from(ledgerAccountsTable)
    .where(
      and(
        eq(ledgerAccountsTable.organizationId, ctx.organizationId),
        eq(ledgerAccountsTable.mode, ctx.mode),
        eq(ledgerAccountsTable.key, 'cash')
      )
    )
    .limit(1);

  if (!cash) return 'pending';

  const balance = await getAccountBalance(db, cash.id);
  return balance !== 0 ? 'settled' : 'pending';
}
