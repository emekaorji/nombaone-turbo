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
 * Interval switches are rejected: prorating a different cadence's amount over the
 * current (old-cadence) window mis-charges, and correct interval-switch proration
 * needs period-claim-spine re-anchoring not yet built — see
 * `PRORATION_INTERVAL_SWITCH_UNSUPPORTED`.
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

  // Interval-switch guard (C4): a target price whose cadence differs cannot be
  // prorated over the current (old-cadence) window without mis-charging — the new
  // per-interval amount would be billed against the old period's remaining time
  // (e.g. a full year against the remaining days of a month). Reject rather than
  // overcharge until interval-aware, period-re-anchoring proration lands.
  const cadenceChanged =
    newPrice.interval !== oldPrice.interval || newPrice.intervalCount !== oldPrice.intervalCount;
  if (input.intervalSwitch === true || cadenceChanged) {
    throw AppError.UnprocessableEntity(
      'interval-switch proration is not yet supported; create a new subscription on the target interval instead',
      {
        reference,
        from: { interval: oldPrice.interval, intervalCount: oldPrice.intervalCount },
        to: { interval: newPrice.interval, intervalCount: newPrice.intervalCount },
      },
      NOMBAONE_ERROR_CODES.PRORATION_INTERVAL_SWITCH_UNSUPPORTED
    );
  }

  const newQty = input.quantity ?? item.quantity;
  const oldAmount = item.unitAmount * item.quantity;
  const newAmount = newPrice.unitAmount * newQty;

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, sub.customerId))
    .limit(1);

  // 1. CLAIM the change atomically — item swap + version-guarded subscription
  //    update commit together; a stale version throws here, BEFORE any money moves.
  await txDb.transaction(async (tx) => {
    await tx
      .update(subscriptionItemsTable)
      .set({ priceId: newPrice.id, unitAmount: newPrice.unitAmount, quantity: newQty })
      .where(
        and(
          eq(subscriptionItemsTable.organizationId, ctx.organizationId),
          eq(subscriptionItemsTable.environment, ctx.environment),
          eq(subscriptionItemsTable.subscriptionId, sub.id)
        )
      );
    const [updated] = await tx
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
  });

  // 2. The change is reserved; apply proration on the pool handle. `sub` is the
  //    pre-swap row, used only for currentPeriodStart/End + ids (unchanged by the
  //    swap); the old/new amounts are the ones captured above. A crash here
  //    under-collects the one-time proration (recoverable) — far safer than the
  //    pre-claim charge it replaces.
  await applyProration(txDb, ctx, {
    subscription: sub,
    customerRef: customer?.reference ?? '',
    oldAmountKobo: oldAmount,
    newAmountKobo: newAmount,
    changeAt: new Date(),
    prorationBehavior: input.prorationBehavior,
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference, prorationBehavior: input.prorationBehavior },
  });
  return getSubscriptionByReference(txDb, ctx, reference);
}
