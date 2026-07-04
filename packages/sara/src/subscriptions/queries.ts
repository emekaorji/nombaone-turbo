import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';

import {
  customersTable,
  invoicesTable,
  paymentMethodsTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { serializeSubscription } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '../context';
import type { Page } from '../pagination';
import type { ListSubscriptionsOptions, SubscriptionItemData, SubscriptionResponseData } from './types';

/** Load the raw subscription row by reference within scope (for transitions). */
export async function loadSubscriptionRow(
  db: InfraReadScope,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionRow> {
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        eq(subscriptionsTable.reference, reference)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound(
      'subscription not found',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }
  return row;
}

async function loadItems(
  db: InfraDb,
  ctx: DomainContext,
  subscriptionIds: string[]
): Promise<Map<string, SubscriptionItemData[]>> {
  const map = new Map<string, SubscriptionItemData[]>();
  if (subscriptionIds.length === 0) return map;
  const rows = await db
    .select({ item: subscriptionItemsTable, priceRef: pricesTable.reference })
    .from(subscriptionItemsTable)
    .innerJoin(pricesTable, eq(subscriptionItemsTable.priceId, pricesTable.id))
    .where(
      and(
        eq(subscriptionItemsTable.organizationId, ctx.organizationId),
        eq(subscriptionItemsTable.mode, ctx.mode),
        inArray(subscriptionItemsTable.subscriptionId, subscriptionIds)
      )
    );
  for (const r of rows) {
    const arr = map.get(r.item.subscriptionId) ?? [];
    arr.push({ id: r.item.reference, priceId: r.priceRef, quantity: r.item.quantity });
    map.set(r.item.subscriptionId, arr);
  }
  return map;
}

async function latestInvoiceRef(
  db: InfraDb,
  ctx: DomainContext,
  subscriptionId: string
): Promise<string | null> {
  const [row] = await db
    .select({ reference: invoicesTable.reference })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.mode, ctx.mode),
        eq(invoicesTable.subscriptionId, subscriptionId)
      )
    )
    .orderBy(desc(invoicesTable.createdAt), desc(invoicesTable.id))
    .limit(1);
  return row?.reference ?? null;
}

const subscriptionSelect = {
  sub: subscriptionsTable,
  customerRef: customersTable.reference,
  priceRef: pricesTable.reference,
  pmRef: paymentMethodsTable.reference,
};

/** Resolve one subscription by reference within scope → the full DTO. */
export async function getSubscriptionByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionResponseData> {
  const [found] = await db
    .select(subscriptionSelect)
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .leftJoin(paymentMethodsTable, eq(subscriptionsTable.defaultPaymentMethodId, paymentMethodsTable.id))
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        eq(subscriptionsTable.reference, reference)
      )
    )
    .limit(1);
  if (!found) {
    throw AppError.NotFound(
      'subscription not found',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }
  const itemsMap = await loadItems(db, ctx, [found.sub.id]);
  const latest = await latestInvoiceRef(db, ctx, found.sub.id);
  return serializeSubscription(
    found.sub,
    { customerRef: found.customerRef, priceRef: found.priceRef, defaultPaymentMethodRef: found.pmRef ?? null },
    itemsMap.get(found.sub.id) ?? [],
    latest
  );
}

/** Keyset-paginated list within scope, optional `customerRef`/`status` filters. */
export async function listSubscriptions(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListSubscriptionsOptions = {}
): Promise<Page<SubscriptionResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  let customerId: string | undefined;
  if (opts.customerRef) {
    const [c] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, ctx.organizationId),
          eq(customersTable.mode, ctx.mode),
          eq(customersTable.reference, opts.customerRef)
        )
      )
      .limit(1);
    if (!c) return { data: [], nextCursor: null, hasMore: false };
    customerId = c.id;
  }

  const tenantScope = and(
    eq(subscriptionsTable.organizationId, ctx.organizationId),
    eq(subscriptionsTable.mode, ctx.mode),
    customerId ? eq(subscriptionsTable.customerId, customerId) : undefined,
    opts.status ? eq(subscriptionsTable.status, opts.status) : undefined
  );

  const keyset = cursor
    ? or(
        lt(subscriptionsTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(subscriptionsTable.createdAt, new Date(cursor.createdAt)),
          lt(subscriptionsTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select(subscriptionSelect)
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
    .leftJoin(paymentMethodsTable, eq(subscriptionsTable.defaultPaymentMethodId, paymentMethodsTable.id))
    .where(keyset ? and(tenantScope, keyset) : tenantScope)
    .orderBy(desc(subscriptionsTable.createdAt), desc(subscriptionsTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({
    createdAt: new Date(row.sub.createdAt).toISOString(),
    id: row.sub.id,
  }));
  const itemsMap = await loadItems(db, ctx, page.data.map((r) => r.sub.id));

  return {
    ...page,
    data: page.data.map((r) =>
      serializeSubscription(
        r.sub,
        { customerRef: r.customerRef, priceRef: r.priceRef, defaultPaymentMethodRef: r.pmRef ?? null },
        itemsMap.get(r.sub.id) ?? [],
        null
      )
    ),
  };
}
