import { and, eq } from 'drizzle-orm';

import { customersTable, discountsTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { assertRedeemable, getCouponByReferenceOrCode, redeemCoupon } from '../coupons';
import { emitEvent } from '../events';
import { mintReference } from '../reference';
import {
  getDiscountByReference,
  loadActiveDiscountForCustomer,
  loadActiveDiscountForSubscription,
} from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { ApplyDiscountInput, DiscountResponseData } from './types';

/**
 * Apply a coupon to a target (one of customer / subscription). Validates the coupon
 * is redeemable, atomically redeems it (K2), and writes the `discounts` row with
 * `cycles_remaining` from the coupon's duration (`once`→1, `repeating`→N,
 * `forever`→null). At most one active discount per target (pre-check + the partial
 * unique index backstop). Emits `discount.created`.
 */
export async function applyDiscount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ApplyDiscountInput
): Promise<DiscountResponseData> {
  const coupon = await getCouponByReferenceOrCode(txDb, ctx, input.couponRefOrCode);
  assertRedeemable(coupon, new Date());

  let customerId: string | null = null;
  let subscriptionId: string | null = null;

  if (input.subscriptionRef) {
    const [sub] = await txDb
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.organizationId, ctx.organizationId),
          eq(subscriptionsTable.environment, ctx.environment),
          eq(subscriptionsTable.reference, input.subscriptionRef)
        )
      )
      .limit(1);
    if (!sub) {
      throw AppError.NotFound(
        'subscription not found',
        { reference: input.subscriptionRef },
        NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
      );
    }
    subscriptionId = sub.id;
    if (await loadActiveDiscountForSubscription(txDb, ctx, sub.id)) {
      throw AppError.Conflict(
        'subscription already has an active discount',
        { reference: input.subscriptionRef },
        NOMBAONE_ERROR_CODES.COUPON_ALREADY_APPLIED
      );
    }
  } else if (input.customerRef) {
    const [customer] = await txDb
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, ctx.organizationId),
          eq(customersTable.environment, ctx.environment),
          eq(customersTable.reference, input.customerRef)
        )
      )
      .limit(1);
    if (!customer) {
      throw AppError.NotFound(
        'customer not found',
        { reference: input.customerRef },
        NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
      );
    }
    customerId = customer.id;
    if (await loadActiveDiscountForCustomer(txDb, ctx, customer.id)) {
      throw AppError.Conflict(
        'customer already has an active discount',
        { reference: input.customerRef },
        NOMBAONE_ERROR_CODES.COUPON_ALREADY_APPLIED
      );
    }
  } else {
    throw AppError.UnprocessableEntity(
      'a customer or subscription target is required',
      {},
      NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION
    );
  }

  await redeemCoupon(txDb, ctx, coupon.id, coupon.reference);

  const cyclesRemaining =
    coupon.duration === 'once' ? 1 : coupon.duration === 'repeating' ? coupon.durationInCycles : null;
  const reference = mintReference('DSC');
  await txDb.insert(discountsTable).values({
    reference,
    organizationId: ctx.organizationId,
    environment: ctx.environment,
    couponId: coupon.id,
    customerId,
    subscriptionId,
    cyclesRemaining,
    status: 'active',
  });
  await emitEvent(txDb, {
    ...ctx,
    type: 'discount.created',
    payload: { reference, coupon: coupon.reference },
  });
  return getDiscountByReference(txDb, ctx, reference);
}
