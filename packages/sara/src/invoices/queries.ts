import { and, asc, desc, eq, gt, inArray, isNull, isNotNull, lt, or, type SQL } from 'drizzle-orm';

import {
  customersTable,
  invoiceLineItemsTable,
  invoicesTable,
  subscriptionsTable,
  type InvoiceRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { serializeInvoice, serializeInvoiceLine } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '../context';
import type { Page } from '../pagination';
import type { InvoiceLineItemData, InvoiceResponseData, InvoiceStatus, ListInvoicesOptions } from './types';

/** Load the raw invoice row by reference within scope. */
export async function loadInvoiceRow(
  db: InfraReadScope,
  ctx: DomainContext,
  reference: string
): Promise<InvoiceRow> {
  const [row] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.environment, ctx.environment),
        eq(invoicesTable.reference, reference)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound('invoice not found', { reference }, NOMBAONE_ERROR_CODES.INVOICE_NOT_FOUND);
  }
  return row;
}

async function loadLines(
  db: InfraDb,
  ctx: DomainContext,
  invoiceIds: string[]
): Promise<Map<string, InvoiceLineItemData[]>> {
  const map = new Map<string, InvoiceLineItemData[]>();
  if (invoiceIds.length === 0) return map;
  const rows = await db
    .select()
    .from(invoiceLineItemsTable)
    .where(
      and(
        eq(invoiceLineItemsTable.organizationId, ctx.organizationId),
        eq(invoiceLineItemsTable.environment, ctx.environment),
        inArray(invoiceLineItemsTable.invoiceId, invoiceIds)
      )
    )
    .orderBy(asc(invoiceLineItemsTable.createdAt), asc(invoiceLineItemsTable.id));
  for (const row of rows) {
    const arr = map.get(row.invoiceId) ?? [];
    arr.push(serializeInvoiceLine(row));
    map.set(row.invoiceId, arr);
  }
  return map;
}

/** Raw line rows for the finalize invariant check. */
export async function getInvoiceLineRows(db: InfraReadScope, ctx: DomainContext, invoiceId: string) {
  return db
    .select()
    .from(invoiceLineItemsTable)
    .where(
      and(
        eq(invoiceLineItemsTable.organizationId, ctx.organizationId),
        eq(invoiceLineItemsTable.environment, ctx.environment),
        eq(invoiceLineItemsTable.invoiceId, invoiceId)
      )
    );
}

/** Translate a DERIVED status into the equivalent timestamp predicate (for filtering). */
function statusPredicate(status: InvoiceStatus): SQL | undefined {
  switch (status) {
    case 'void':
      return isNotNull(invoicesTable.voidedAt);
    case 'uncollectible':
      return and(isNotNull(invoicesTable.uncollectibleAt), isNull(invoicesTable.voidedAt));
    case 'paid':
      return and(
        isNotNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt)
      );
    case 'draft':
      return and(isNull(invoicesTable.finalizedAt), isNull(invoicesTable.voidedAt));
    case 'partially_paid':
      return and(
        isNotNull(invoicesTable.finalizedAt),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt),
        gt(invoicesTable.amountPaid, 0)
      );
    case 'open':
      return and(
        isNotNull(invoicesTable.finalizedAt),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt),
        eq(invoicesTable.amountPaid, 0)
      );
    default:
      return undefined;
  }
}

const invoiceSelect = {
  inv: invoicesTable,
  customerRef: customersTable.reference,
  subRef: subscriptionsTable.reference,
};

export async function getInvoiceByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<InvoiceResponseData> {
  const [found] = await db
    .select(invoiceSelect)
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(subscriptionsTable, eq(invoicesTable.subscriptionId, subscriptionsTable.id))
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.environment, ctx.environment),
        eq(invoicesTable.reference, reference)
      )
    )
    .limit(1);
  if (!found) {
    throw AppError.NotFound('invoice not found', { reference }, NOMBAONE_ERROR_CODES.INVOICE_NOT_FOUND);
  }
  const linesMap = await loadLines(db, ctx, [found.inv.id]);
  return serializeInvoice(found.inv, found.customerRef, found.subRef ?? null, linesMap.get(found.inv.id) ?? []);
}

export async function listInvoices(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListInvoicesOptions = {}
): Promise<Page<InvoiceResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const resolveId = async (table: typeof customersTable | typeof subscriptionsTable, ref: string) => {
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .where(
        and(eq(table.organizationId, ctx.organizationId), eq(table.environment, ctx.environment), eq(table.reference, ref))
      )
      .limit(1);
    return row?.id;
  };

  let customerId: string | undefined;
  if (opts.customerRef) {
    customerId = await resolveId(customersTable, opts.customerRef);
    if (!customerId) return { data: [], nextCursor: null, hasMore: false };
  }
  let subscriptionId: string | undefined;
  if (opts.subscriptionRef) {
    subscriptionId = await resolveId(subscriptionsTable, opts.subscriptionRef);
    if (!subscriptionId) return { data: [], nextCursor: null, hasMore: false };
  }

  const tenantScope = and(
    eq(invoicesTable.organizationId, ctx.organizationId),
    eq(invoicesTable.environment, ctx.environment),
    customerId ? eq(invoicesTable.customerId, customerId) : undefined,
    subscriptionId ? eq(invoicesTable.subscriptionId, subscriptionId) : undefined,
    opts.status ? statusPredicate(opts.status) : undefined
  );

  const keyset = cursor
    ? or(
        lt(invoicesTable.createdAt, new Date(cursor.createdAt)),
        and(eq(invoicesTable.createdAt, new Date(cursor.createdAt)), lt(invoicesTable.id, cursor.id))
      )
    : undefined;

  const rows = await db
    .select(invoiceSelect)
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(subscriptionsTable, eq(invoicesTable.subscriptionId, subscriptionsTable.id))
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(invoicesTable.createdAt), desc(invoicesTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.inv.createdAt).toISOString(),
    id: row.inv.id,
  }));
  const linesMap = await loadLines(db, ctx, page.data.map((r) => r.inv.id));

  return {
    ...page,
    data: page.data.map((r) =>
      serializeInvoice(r.inv, r.customerRef, r.subRef ?? null, linesMap.get(r.inv.id) ?? [])
    ),
  };
}
