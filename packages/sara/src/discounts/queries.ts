import { and, eq } from 'drizzle-orm';

import {
  couponsTable,
  customersTable,
  discountsTable,
  subscriptionsTable,
  type DiscountRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { serializeDiscount } from './serialize';

import type { DomainContext, InfraDb, InfraReadScope } from '../context';
import type { DiscountResponseData } from './types';

export async function loadActiveDiscountForSubscription(
  scope: InfraReadScope,
  ctx: DomainContext,
  subscriptionId: string
): Promise<DiscountRow | null> {
  const [row] = await scope
    .select()
    .from(discountsTable)
    .where(
      and(
        eq(discountsTable.organizationId, ctx.organizationId),
        eq(discountsTable.mode, ctx.mode),
        eq(discountsTable.subscriptionId, subscriptionId),
        eq(discountsTable.status, 'active')
      )
    )
    .limit(1);
  return row ?? null;
}

export async function loadActiveDiscountForCustomer(
  scope: InfraReadScope,
  ctx: DomainContext,
  customerId: string
): Promise<DiscountRow | null> {
  const [row] = await scope
    .select()
    .from(discountsTable)
    .where(
      and(
        eq(discountsTable.organizationId, ctx.organizationId),
        eq(discountsTable.mode, ctx.mode),
        eq(discountsTable.customerId, customerId),
        eq(discountsTable.status, 'active')
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getDiscountByReference(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<DiscountResponseData> {
  const [found] = await db
    .select({
      d: discountsTable,
      couponRef: couponsTable.reference,
      customerRef: customersTable.reference,
      subRef: subscriptionsTable.reference,
    })
    .from(discountsTable)
    .innerJoin(couponsTable, eq(discountsTable.couponId, couponsTable.id))
    .leftJoin(customersTable, eq(discountsTable.customerId, customersTable.id))
    .leftJoin(subscriptionsTable, eq(discountsTable.subscriptionId, subscriptionsTable.id))
    .where(
      and(
        eq(discountsTable.organizationId, ctx.organizationId),
        eq(discountsTable.mode, ctx.mode),
        eq(discountsTable.reference, reference)
      )
    )
    .limit(1);
  if (!found) {
    throw AppError.NotFound(
      'discount not found',
      { reference },
      NOMBAONE_ERROR_CODES.DISCOUNT_NOT_FOUND
    );
  }
  return serializeDiscount(found.d, {
    couponRef: found.couponRef,
    customerRef: found.customerRef ?? null,
    subscriptionRef: found.subRef ?? null,
  });
}
