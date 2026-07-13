import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  paymentMethodsTable,
  subscriptionsTable,
  type PaymentMethodRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';

import { loadSubscriptionRow } from '../subscriptions';
import { triggerReattemptNow } from './attempt';
import { getDunningStateBySubscriptionRef } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

export interface UpdateCardInput {
  subscriptionRef: string;
  paymentMethodReference: string;
}

export interface UpdateCardResult {
  method: PaymentMethodRow;
  customerRef: string;
}

/**
 * Swap the card on a subscription mid-dunning (D10 / E6 ★) by promoting an
 * already-captured `payment_methods` row (it must belong to the subscription's
 * customer). There is deliberately NO raw-token path here: the removed
 * `checkoutToken` variant inserted an attacker-suppliable string verbatim as an
 * active default card's `tokenKey` — an unverified string became a chargeable
 * credential. Fresh cards are captured only by the hosted checkout, whose
 * provider webhook attaches the row server-side. The default swap happens in
 * ONE transaction — the OLD token stays valid until the new one commits, so there is
 * **never a zero-valid-token-but-billable window** (E6). The superseded card is
 * marked `removed`. After commit, if the sub is mid-dunning (`card_update_required`),
 * an immediate re-attempt is armed (D10) rather than waiting for the next cron.
 */
export async function updateCardOnSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: UpdateCardInput
): Promise<UpdateCardResult> {
  const sub = await loadSubscriptionRow(txDb, ctx, input.subscriptionRef);
  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, sub.customerId))
    .limit(1);

  const newMethod = await txDb.transaction(async (tx) => {
    // Resolve the replacement method — an existing captured row only.
    const [existing] = await tx
      .select()
      .from(paymentMethodsTable)
      .where(
        and(
          eq(paymentMethodsTable.organizationId, ctx.organizationId),
          eq(paymentMethodsTable.mode, ctx.mode),
          eq(paymentMethodsTable.reference, input.paymentMethodReference),
          eq(paymentMethodsTable.customerId, sub.customerId)
        )
      )
      .limit(1);
    if (!existing) {
      throw AppError.NotFound(
        'payment method not found for this subscription customer',
        { reference: input.paymentMethodReference },
        NOMBAONE_ERROR_CODES.SUBSCRIPTION_PAYMENT_METHOD_REQUIRED
      );
    }
    const replacement: PaymentMethodRow = existing;

    // Clear the old default (partial-unique on is_default) then set the new one.
    if (sub.defaultPaymentMethodId && sub.defaultPaymentMethodId !== replacement.id) {
      await tx
        .update(paymentMethodsTable)
        .set({ isDefault: false, status: 'removed' })
        .where(eq(paymentMethodsTable.id, sub.defaultPaymentMethodId));
    }
    const [activated] = await tx
      .update(paymentMethodsTable)
      .set({ isDefault: true, status: 'active' })
      .where(eq(paymentMethodsTable.id, replacement.id))
      .returning();

    await tx
      .update(subscriptionsTable)
      .set({ defaultPaymentMethodId: replacement.id })
      .where(eq(subscriptionsTable.id, sub.id));

    return activated ?? replacement;
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.updated',
    payload: { reference: newMethod.reference, subscription: sub.reference },
  });

  // Mid-dunning → prompt an immediate re-attempt (D10), not the next cron tick.
  const state = await getDunningStateBySubscriptionRef(txDb, ctx, sub.reference);
  if (state.invoice) {
    await triggerReattemptNow(txDb, ctx, state.invoice.id);
  }

  return { method: newMethod, customerRef: customer?.reference ?? '' };
}
