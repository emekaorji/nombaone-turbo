import { and, eq } from 'drizzle-orm';

import { customersTable, discountsTable, subscriptionsTable, type DiscountRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import {
  getDiscountByReference,
  loadActiveDiscountForCustomer,
  loadActiveDiscountForSubscription,
} from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { DiscountResponseData, RemoveDiscountTarget } from './types';

/** End (release) the active discount on a target. Emits `discount.removed`. */
export async function removeDiscount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  target: RemoveDiscountTarget
): Promise<DiscountResponseData> {
  let discount: DiscountRow | null = null;

  if (target.subscriptionRef) {
    const [sub] = await txDb
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.organizationId, ctx.organizationId),
          eq(subscriptionsTable.environment, ctx.environment),
          eq(subscriptionsTable.reference, target.subscriptionRef)
        )
      )
      .limit(1);
    if (sub) discount = await loadActiveDiscountForSubscription(txDb, ctx, sub.id);
  } else if (target.customerRef) {
    const [customer] = await txDb
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, ctx.organizationId),
          eq(customersTable.environment, ctx.environment),
          eq(customersTable.reference, target.customerRef)
        )
      )
      .limit(1);
    if (customer) discount = await loadActiveDiscountForCustomer(txDb, ctx, customer.id);
  }

  if (!discount) {
    throw AppError.NotFound(
      'no active discount on the target',
      { ...target },
      NOMBAONE_ERROR_CODES.DISCOUNT_NOT_FOUND
    );
  }

  await txDb
    .update(discountsTable)
    .set({ status: 'ended', endAt: new Date() })
    .where(eq(discountsTable.id, discount.id));
  await emitEvent(txDb, {
    ...ctx,
    type: 'discount.removed',
    payload: { reference: discount.reference },
  });
  return getDiscountByReference(txDb, ctx, discount.reference);
}
