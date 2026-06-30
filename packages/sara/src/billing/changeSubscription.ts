import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { getSubscriptionByReference, loadSubscriptionRow } from '../subscriptions';
import { applyProration } from './applyProration';
import { loadPriceById, loadPrimarySubscriptionItem } from './effects';

import type { DomainContext, InfraTxDb } from '../context';
import type { ProrationBehavior } from '../proration';
import type { SubscriptionResponseData } from '../subscriptions';

export interface ChangeSubscriptionInput {
  priceRef?: string;
  quantity?: number;
  intervalSwitch?: boolean;
  prorationBehavior: ProrationBehavior;
}

/**
 * Change a subscription mid-cycle (price swap / interval switch / quantity) and run
 * proration (05) — distinct from 03's metadata-only `updateSubscription`. Computes
 * the old vs new effective period amount, applies proration (upgrade charges now,
 * downgrade banks a credit), then swaps the item's price/quantity and the
 * subscription's effective price under the optimistic version guard.
 */
export async function changeSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: ChangeSubscriptionInput
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
    throw AppError.UnprocessableEntity(
      'cannot change a terminated subscription',
      { reference, status: sub.status },
      NOMBAONE_ERROR_CODES.PRORATION_NOT_APPLICABLE
    );
  }

  const item = await loadPrimarySubscriptionItem(txDb, ctx, sub.id);
  let newPrice = await loadPriceById(txDb, ctx, sub.priceId);
  if (input.priceRef) {
    const [price] = await txDb
      .select()
      .from(pricesTable)
      .where(
        and(
          eq(pricesTable.organizationId, ctx.organizationId),
          eq(pricesTable.environment, ctx.environment),
          eq(pricesTable.reference, input.priceRef)
        )
      )
      .limit(1);
    if (!price) {
      throw AppError.NotFound(
        'price not found',
        { reference: input.priceRef },
        NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND
      );
    }
    newPrice = price;
  }

  const newQty = input.quantity ?? item.quantity;
  const oldAmount = item.unitAmount * item.quantity;
  const newAmount = newPrice.unitAmount * newQty;

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, sub.customerId))
    .limit(1);

  await applyProration(txDb, ctx, {
    subscription: sub,
    customerRef: customer?.reference ?? '',
    oldAmountKobo: oldAmount,
    newAmountKobo: newAmount,
    changeAt: new Date(),
    prorationBehavior: input.prorationBehavior,
  });

  await txDb
    .update(subscriptionItemsTable)
    .set({ priceId: newPrice.id, unitAmount: newPrice.unitAmount, quantity: newQty })
    .where(
      and(
        eq(subscriptionItemsTable.organizationId, ctx.organizationId),
        eq(subscriptionItemsTable.environment, ctx.environment),
        eq(subscriptionItemsTable.subscriptionId, sub.id)
      )
    );
  const [updated] = await txDb
    .update(subscriptionsTable)
    .set({ priceId: newPrice.id, version: sub.version + 1 })
    .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
    .returning();
  if (!updated) {
    throw AppError.Conflict(
      'subscription was modified concurrently; retry',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference, prorationBehavior: input.prorationBehavior },
  });
  return getSubscriptionByReference(txDb, ctx, reference);
}
