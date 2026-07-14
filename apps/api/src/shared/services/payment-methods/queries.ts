import { and, desc, eq, lt, or } from 'drizzle-orm';

import { customersTable, paymentMethodsTable, type PaymentMethodRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';
import { buildPage, clampLimit, decodeCursor } from '@nombaone/sara/pagination';

import { serializePaymentMethod } from './serialize';

import type { DomainContext, Mode, InfraDb, InfraTxDb } from '@nombaone/sara/context';
import type { Page } from '@nombaone/sara/pagination';
import type { ListPaymentMethodsOptions, PaymentMethodResponseData } from './types';

export interface PendingMandate {
  organizationId: string;
  reference: string;
}

/**
 * Select `consent_pending` direct-debit mandates for the activation sweep — a NIBSS
 * mandate has no consent webhook, so a cron polls each pending mandate's status until
 * it goes ACTIVE. Env-scoped (the sweep runs per mode); the handler rebuilds
 * each mandate's owning-org context to poll it.
 */
export async function selectPendingMandates(
  db: InfraDb,
  mode: Mode,
  limit: number
): Promise<PendingMandate[]> {
  return db
    .select({
      organizationId: paymentMethodsTable.organizationId,
      reference: paymentMethodsTable.reference,
    })
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.mode, mode),
        eq(paymentMethodsTable.kind, 'mandate'),
        eq(paymentMethodsTable.status, 'consent_pending')
      )
    )
    .orderBy(desc(paymentMethodsTable.createdAt))
    .limit(limit);
}

/** Resolve one payment method by reference within scope (joins the customer ref). */
export async function getPaymentMethodByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<PaymentMethodResponseData> {
  const found = await loadByReference(db, ctx, reference);
  return serializePaymentMethod(found.method, found.customerRef);
}

/** Keyset-paginated list, optionally filtered by `customerRef`, within scope. */
export async function listPaymentMethods(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListPaymentMethodsOptions = {}
): Promise<Page<PaymentMethodResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  const tenantScope = and(
    eq(paymentMethodsTable.organizationId, ctx.organizationId),
    eq(paymentMethodsTable.mode, ctx.mode),
    opts.customerRef ? eq(customersTable.reference, opts.customerRef) : undefined
  );

  const keyset = cursor
    ? or(
        lt(paymentMethodsTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(paymentMethodsTable.createdAt, new Date(cursor.createdAt)),
          lt(paymentMethodsTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select({ method: paymentMethodsTable, customerRef: customersTable.reference })
    .from(paymentMethodsTable)
    .innerJoin(customersTable, eq(paymentMethodsTable.customerId, customersTable.id))
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(paymentMethodsTable.createdAt), desc(paymentMethodsTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.method.createdAt).toISOString(),
    id: row.method.id,
  }));

  return {
    ...page,
    data: page.data.map((row) => serializePaymentMethod(row.method, row.customerRef)),
  };
}

/**
 * Make one method the customer's default (per mode). Done in one
 * transaction: clear the customer's existing default, then set this one — so the
 * partial-unique `(customer, mode) where is_default` is never violated.
 */
export async function setDefaultPaymentMethod(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<PaymentMethodResponseData> {
  const found = await loadByReference(txDb, ctx, reference);

  await txDb.transaction(async (tx) => {
    await tx
      .update(paymentMethodsTable)
      .set({ isDefault: false })
      .where(
        and(
          eq(paymentMethodsTable.customerId, found.method.customerId),
          eq(paymentMethodsTable.mode, ctx.mode),
          eq(paymentMethodsTable.isDefault, true)
        )
      );
    await tx
      .update(paymentMethodsTable)
      .set({ isDefault: true })
      .where(eq(paymentMethodsTable.id, found.method.id));
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.updated',
    payload: { reference, isDefault: true },
  });

  const refreshed = await loadByReference(txDb, ctx, reference);
  return serializePaymentMethod(refreshed.method, refreshed.customerRef);
}

/** The active default method for a customer (used by the billing core in 03). */
export async function getDefaultForCustomer(
  db: InfraDb,
  ctx: DomainContext,
  customerId: string
): Promise<PaymentMethodRow | null> {
  const [row] = await db
    .select()
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.organizationId, ctx.organizationId),
        eq(paymentMethodsTable.mode, ctx.mode),
        eq(paymentMethodsTable.customerId, customerId),
        eq(paymentMethodsTable.isDefault, true)
      )
    )
    .limit(1);
  return row ?? null;
}

/** Load a method + its customer reference within scope, or throw NOT_FOUND. */
export async function loadByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<{ method: PaymentMethodRow; customerRef: string }> {
  const [found] = await db
    .select({ method: paymentMethodsTable, customerRef: customersTable.reference })
    .from(paymentMethodsTable)
    .innerJoin(customersTable, eq(paymentMethodsTable.customerId, customersTable.id))
    .where(
      and(
        eq(paymentMethodsTable.organizationId, ctx.organizationId),
        eq(paymentMethodsTable.mode, ctx.mode),
        eq(paymentMethodsTable.reference, reference)
      )
    )
    .limit(1);

  if (!found) {
    throw AppError.NotFound(
      'payment method not found',
      { reference },
      NOMBAONE_ERROR_CODES.PAYMENT_METHOD_NOT_FOUND
    );
  }
  return found;
}
