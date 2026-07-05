import { and, desc, eq, lt, or } from 'drizzle-orm';

import { customersTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';
import { serializeCustomer } from './serialize';

import type { DomainContext, InfraDb } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
import type { CustomerResponseData, ListCustomersOptions } from './types';

/**
 * Reads resolve by reference, server-side, within the caller's pinned scope: the
 * route param is a hint, never proof of ownership — scope is enforced in the
 * WHERE clause, so a reference from another tenant simply does not exist for this
 * caller. Listing is keyset-paginated on `(created_at desc, id desc)` (the
 * table's `keyset` index): fetch `limit + 1`, slice, emit an opaque cursor. No
 * COUNT(*), no OFFSET.
 */

/** Resolve one customer by its public reference within the caller's scope. */
export async function getCustomerByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<CustomerResponseData> {
  const [row] = await db
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.reference, reference)
      )
    )
    .limit(1);

  if (!row) {
    throw AppError.NotFound(
      'customer not found',
      { reference },
      NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
    );
  }

  return serializeCustomer(row);
}

/** Keyset-paginated list, optionally filtered by `email`, within scope. */
export async function listCustomers(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListCustomersOptions = {}
): Promise<Page<CustomerResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const tenantScope = and(
    eq(customersTable.organizationId, ctx.organizationId),
    eq(customersTable.mode, ctx.mode),
    opts.email ? eq(customersTable.email, opts.email) : undefined
  );

  // Strict keyset predicate: rows strictly "after" the cursor in (createdAt, id)
  // descending order — older createdAt, or same createdAt with a smaller id.
  const keyset = cursor
    ? or(
        lt(customersTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(customersTable.createdAt, new Date(cursor.createdAt)),
          lt(customersTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select()
    .from(customersTable)
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(customersTable.createdAt), desc(customersTable.id))
    .limit(limit + 1);

  // Page off the RAW rows so the keyset cursor encodes the real (createdAt, UUID
  // id) index columns — not the public reference. Serialize only the data.
  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
  }));

  return {
    ...page,
    data: page.data.map(serializeCustomer),
  };
}
