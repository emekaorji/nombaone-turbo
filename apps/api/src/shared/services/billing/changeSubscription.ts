import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { getSubscriptionByReference, loadSubscriptionRow } from '../subscriptions';
import { applyIntervalSwitch, applyProration } from './applyProration';
import { loadPriceById, loadPrimarySubscriptionItem } from './effects';
import { reanchorForIntervalSwitch } from './scheduling';

import type { SubscriptionInsert } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { ProrationBehavior } from '../proration';
import type { SubscriptionResponseData } from '../subscriptions';

export interface ChangeSubscriptionInput {
  priceRef?: string;
  quantity?: number;
  intervalSwitch?: boolean;
  prorationBehavior: ProrationBehavior;
}

/**
 * Change a subscription mid-cycle (price swap / quantity) and run proration (05) —
 * distinct from 03's metadata-only `updateSubscription`.
 *
 * Ordering is money-safety-critical. The change is CLAIMED atomically FIRST — the
 * item swap and the optimistic version-guarded subscription update commit together
 * in one transaction — and only THEN is proration applied (upgrade charges now,
 * downgrade banks a credit). Money moving strictly after the claim means a
 * concurrent modification (stale `version`) throws BEFORE any charge/credit, so a
 * conflict can never leave a charged-but-not-swapped torn state, and an idempotent
 * retry re-checks the version against fresh state instead of double-charging.
 * (`postTransaction`/`emitEvent` require the pool handle, so proration runs after
 * the claim commits, mirroring `createSubscription`'s charge-after-claim shape.)
 *
 * INTERVAL SWITCH (monthly↔yearly, C4): when the cadence changes, we do NOT prorate
 * the new price over the old window (that mis-charges a year against a month). We
 * credit the unused old-cadence remainder, charge a FULL fresh new-cadence period,
 * and RE-ANCHOR the cycle — keeping `current_period_index` monotonic (the anchor is
 * back-dated) so the invoice `unique(subscription_id, period_index)` guard never
 * collides. The re-anchor commits atomically inside the same claim transaction.
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
  const oldPrice = await loadPriceById(txDb, ctx, sub.priceId);
  let newPrice = oldPrice;
  if (input.priceRef) {
    const [price] = await txDb
      .select()
      .from(pricesTable)
      .where(
        and(
          eq(pricesTable.organizationId, ctx.organizationId),
          eq(pricesTable.mode, ctx.mode),
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

  // Interval switch (C4): the cadence differs → credit unused old + charge full new
  // + re-anchor (below), instead of mis-prorating the new price over the old window.
  const cadenceChanged =
    newPrice.interval !== oldPrice.interval || newPrice.intervalCount !== oldPrice.intervalCount;
  const isIntervalSwitch = cadenceChanged || input.intervalSwitch === true;

  const newQty = input.quantity ?? item.quantity;
  const oldAmount = item.unitAmount * item.quantity;
  const newAmount = newPrice.unitAmount * newQty;
  const changeAt = new Date();

  // For an interval switch, compute the new anchor + period window (index unchanged,
  // anchor back-dated so no invoice period_index collision). NOT for a trialing sub —
  // re-anchoring would move its trial-end/first-charge date; a trial switch just swaps
  // the price (no money, no re-anchor) and falls through to applyProration's trial no-op.
  const reanchor =
    isIntervalSwitch && sub.status !== 'trialing'
      ? reanchorForIntervalSwitch(changeAt, sub.currentPeriodIndex, {
          interval: newPrice.interval,
          intervalCount: newPrice.intervalCount,
        })
      : null;

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, sub.customerId))
    .limit(1);

  // 1. CLAIM the change atomically — item swap + version-guarded subscription
  //    update (incl. the interval-switch re-anchor) commit together; a stale version
  //    throws here, BEFORE any money moves.
  await txDb.transaction(async (tx) => {
    await tx
      .update(subscriptionItemsTable)
      .set({ priceId: newPrice.id, unitAmount: newPrice.unitAmount, quantity: newQty })
      .where(
        and(
          eq(subscriptionItemsTable.organizationId, ctx.organizationId),
          eq(subscriptionItemsTable.mode, ctx.mode),
          eq(subscriptionItemsTable.subscriptionId, sub.id)
        )
      );
    const subUpdate: Partial<SubscriptionInsert> = { priceId: newPrice.id, version: sub.version + 1 };
    if (reanchor) {
      subUpdate.billingCycleAnchor = reanchor.anchor;
      subUpdate.currentPeriodStart = reanchor.currentPeriodStart;
      subUpdate.currentPeriodEnd = reanchor.currentPeriodEnd;
      subUpdate.nextBillingAt = reanchor.nextBillingAt;
    }
    const [updated] = await tx
      .update(subscriptionsTable)
      .set(subUpdate)
      .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
      .returning();
    if (!updated) {
      throw AppError.Conflict(
        'subscription was modified concurrently; retry',
        { reference },
        NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
      );
    }
  });

  // 2. The change is reserved; apply the money on the pool handle. `sub` is the
  //    pre-swap row (its current period is the OLD-cadence window used for the credit).
  //    A crash here under-collects the one-time proration (recoverable) — far safer
  //    than the pre-claim charge it replaces.
  if (reanchor) {
    await applyIntervalSwitch(txDb, ctx, {
      subscription: sub,
      customerRef: customer?.reference ?? '',
      oldAmountKobo: oldAmount,
      newAmountKobo: newAmount,
      newPeriodEnd: reanchor.currentPeriodEnd,
      changeAt,
      prorationBehavior: input.prorationBehavior,
    });
  } else {
    await applyProration(txDb, ctx, {
      subscription: sub,
      customerRef: customer?.reference ?? '',
      oldAmountKobo: oldAmount,
      newAmountKobo: newAmount,
      changeAt,
      prorationBehavior: input.prorationBehavior,
    });
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference, prorationBehavior: input.prorationBehavior },
  });
  return getSubscriptionByReference(txDb, ctx, reference);
}
