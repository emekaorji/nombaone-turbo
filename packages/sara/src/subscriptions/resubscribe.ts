import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  paymentMethodsTable,
  pricesTable,
  subscriptionItemsTable,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { createSubscription } from './create';
import { loadSubscriptionRow } from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { ResubscribeInput, SubscriptionResponseData } from './types';

/**
 * Resubscribe a canceled subscription: this **mints a brand-new subscription**
 * referencing the same customer (and, by default, the same price/method), and
 * **never mutates the source row** (A2/⚠ — `canceled` is terminal). The source
 * must be terminal, else `SUBSCRIPTION_NOT_TERMINAL`.
 */
export async function resubscribe(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sourceRef: string,
  input: ResubscribeInput
): Promise<SubscriptionResponseData> {
  const source = await loadSubscriptionRow(txDb, ctx, sourceRef);
  if (source.status !== 'canceled') {
    throw AppError.UnprocessableEntity(
      'can only resubscribe a canceled subscription',
      { reference: sourceRef, status: source.status },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_TERMINAL
    );
  }

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, source.customerId))
    .limit(1);
  const [sourcePrice] = await txDb
    .select({ reference: pricesTable.reference })
    .from(pricesTable)
    .where(eq(pricesTable.id, source.priceId))
    .limit(1);

  let sourcePaymentMethodRef: string | undefined;
  if (source.defaultPaymentMethodId) {
    const [pm] = await txDb
      .select({ reference: paymentMethodsTable.reference })
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.id, source.defaultPaymentMethodId))
      .limit(1);
    sourcePaymentMethodRef = pm?.reference;
  }

  const [item] = await txDb
    .select({ quantity: subscriptionItemsTable.quantity })
    .from(subscriptionItemsTable)
    .where(
      and(
        eq(subscriptionItemsTable.organizationId, ctx.organizationId),
        eq(subscriptionItemsTable.environment, ctx.environment),
        eq(subscriptionItemsTable.subscriptionId, source.id)
      )
    )
    .limit(1);

  return createSubscription(txDb, ctx, {
    customerRef: customer?.reference ?? '',
    priceRef: input.priceRef ?? sourcePrice?.reference ?? '',
    paymentMethodRef: input.paymentMethodRef ?? sourcePaymentMethodRef,
    collectionMethod: source.collectionMethod,
    quantity: item?.quantity ?? 1,
    metadata: source.metadata,
  });
}
