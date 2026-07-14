import { and, asc, desc, eq, gt, gte, inArray, isNull, isNotNull, lt, or, type SQL } from 'drizzle-orm';

import {
  customersTable,
  invoiceLineItemsTable,
  invoicesTable,
  subscriptionsTable,
  type InvoiceRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';

import { serializeInvoice, serializeInvoiceLine } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
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
        eq(invoicesTable.mode, ctx.mode),
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
        eq(invoiceLineItemsTable.mode, ctx.mode),
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
        eq(invoiceLineItemsTable.mode, ctx.mode),
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
        eq(invoicesTable.mode, ctx.mode),
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

/** A finalized invoice recently active in one mode — the input to the nightly
 *  Nomba reconcile (item 6). `paidLocally` distinguishes the locally-settled set (which
 *  we verify against Nomba) from the still-unpaid set (which Nomba may have silently
 *  settled — a missed-webhook self-heal candidate). `organizationId` lets the cron
 *  derive the active tenants from the work itself, so idle tenants cost nothing. */
export interface ReconcilableInvoice {
  organizationId: string;
  reference: string;
  amountDueKobo: number;
  paidLocally: boolean;
  /**
   * How many charge attempts this invoice has already burnt. Nomba permanently consumes an order
   * reference, so each attempt opened a DIFFERENT order (`-c0`, `-c1`, …) — and answering "was
   * this invoice paid?" means asking about all of them. Without this the backstop can only see
   * the hosted-checkout order and is blind to every card payment.
   */
  attemptCount: number;
  /**
   * Nomba's own transaction id, when an inbound webhook stamped one. Kept for tracing; it is no
   * longer required to requery (that keys on `?orderReference=`, which we always know).
   */
  providerTransactionId: string | null;
}

/**
 * Finalized, non-void, non-uncollectible invoices in `mode` whose `updated_at`
 * is within the reconcile window (`>= since`) — covers both recently-settled invoices
 * and still-open/past_due ones whose last charge attempt bumped `updated_at`. Scoped
 * by mode, NOT by org, so the cron can reconcile every active tenant in one pass.
 */
export async function getReconcilableInvoicesSince(
  db: InfraReadScope,
  mode: DomainContext['mode'],
  since: Date
): Promise<ReconcilableInvoice[]> {
  const rows = await db
    .select({
      organizationId: invoicesTable.organizationId,
      reference: invoicesTable.reference,
      amountDueKobo: invoicesTable.amountDue,
      paidAt: invoicesTable.paidAt,
      attemptCount: invoicesTable.attemptCount,
      metadata: invoicesTable.metadata,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.mode, mode),
        isNotNull(invoicesTable.finalizedAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt),
        gte(invoicesTable.updatedAt, since)
      )
    );
  return rows.map((r) => {
    const providerTxn = (r.metadata as Record<string, unknown> | null)?.providerTransactionId;
    return {
      organizationId: r.organizationId,
      reference: r.reference,
      amountDueKobo: r.amountDueKobo,
      paidLocally: r.paidAt != null,
      attemptCount: r.attemptCount,
      providerTransactionId: typeof providerTxn === 'string' ? providerTxn : null,
    };
  });
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
        and(eq(table.organizationId, ctx.organizationId), eq(table.mode, ctx.mode), eq(table.reference, ref))
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
    eq(invoicesTable.mode, ctx.mode),
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
