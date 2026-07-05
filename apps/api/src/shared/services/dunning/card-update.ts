import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  paymentMethodsTable,
  subscriptionsTable,
  type PaymentMethodRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { loadSubscriptionRow } from '../subscriptions';
import { triggerReattemptNow } from './attempt';
import { getDunningStateBySubscriptionRef } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

export interface UpdateCardInput {
  subscriptionRef: string;
  paymentMethodReference?: string;
  checkoutToken?: string;
}

export interface UpdateCardResult {
  method: PaymentMethodRow;
  customerRef: string;
}

/**
 * Swap the card on a subscription mid-dunning (D10 / E6 ★). Either promote an
 * existing active `payment_methods` row, or attach a freshly-tokenized card (the
 * captured `checkoutToken` becomes the new `tokenKey`). The default swap happens in
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
    // Resolve (or attach) the replacement method.
    let replacement: PaymentMethodRow;
    if (input.paymentMethodReference) {
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
      replacement = existing;
    } else {
      const [attached] = await tx
        .insert(paymentMethodsTable)
        .values({
          reference: mintReference('PMT'),
          organizationId: ctx.organizationId,
          mode: ctx.mode,
          customerId: sub.customerId,
          kind: 'card',
          status: 'active',
          tokenKey: input.checkoutToken,
        })
        .returning();
      replacement = attached!;
    }

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
