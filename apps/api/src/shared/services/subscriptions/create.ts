import { and, eq } from 'drizzle-orm';

import {
  customersTable,
  paymentMethodsTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { computeAnchor, computeAnchorAtOrAfter } from '../billing/scheduling';
import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { getSubscriptionByReference } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type {
  CreateSubscriptionInput,
  SubscriptionResponseData,
  SubscriptionStatus,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create a subscription. Resolves customer (00) + price (01) + optional payment
 * method (02) within scope, decides the initial FSM state, and inserts the
 * subscription + its first item atomically; emits `subscription.created`.
 *
 * Initial state:
 *  • trial requested (input or price) → `trialing` (no charge attempted, A8);
 *  • `send_invoice` → `active` (an open invoice is issued/awaited);
 *  • `charge_automatically` (no trial) → `incomplete` until the first charge
 *    succeeds (the contract requires a payment method here). SEAM(03d): the
 *    first-cycle charge (`runCycle` → `incomplete → active | past_due`) is wired in
 *    03d; until then the subscription rests in `incomplete`.
 */
export async function createSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateSubscriptionInput
): Promise<SubscriptionResponseData> {
  const [customer] = await txDb
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
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

  let paymentMethodId: string | null = null;
  if (input.paymentMethodRef) {
    const [pm] = await txDb
      .select({ id: paymentMethodsTable.id })
      .from(paymentMethodsTable)
      .where(
        and(
          eq(paymentMethodsTable.organizationId, ctx.organizationId),
          eq(paymentMethodsTable.mode, ctx.mode),
          eq(paymentMethodsTable.reference, input.paymentMethodRef)
        )
      )
      .limit(1);
    if (!pm) {
      throw AppError.NotFound(
        'payment method not found',
        { reference: input.paymentMethodRef },
        NOMBAONE_ERROR_CODES.PAYMENT_METHOD_NOT_FOUND
      );
    }
    paymentMethodId = pm.id;
  }

  const now = new Date();
  const trialDays = input.trialDays ?? price.trialPeriodDays ?? 0;
  const trialing = trialDays > 0;
  const trialStart = trialing ? now : null;
  const trialEnd = trialing ? new Date(now.getTime() + trialDays * DAY_MS) : null;
  const status: SubscriptionStatus = trialing
    ? 'trialing'
    : input.collectionMethod === 'send_invoice'
      ? 'active'
      : 'incomplete';

  // The billing anchor (normalized to the billing hour): period 0 starts at the
  // trial end for a trial, else at activation. `next_billing_at` is the sweep's
  // due cursor — a trial bills at trial end; a non-trial is due now (charged inline
  // by startSubscription for charge_automatically, or by the next sweep otherwise).
  // The TRIAL anchor is clamped at-or-AFTER the trial end so normalizing to the
  // billing hour can never pull the first charge into the trial window (A8).
  const anchor = trialing ? computeAnchorAtOrAfter(trialEnd ?? now) : computeAnchor(now);

  const reference = mintReference('SUB');

  await txDb.transaction(async (tx) => {
    const [sub] = await tx
      .insert(subscriptionsTable)
      .values({
        reference,
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        customerId: customer.id,
        priceId: price.id,
        defaultPaymentMethodId: paymentMethodId,
        status,
        collectionMethod: input.collectionMethod,
        currentPeriodIndex: 0,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd, // non-trial period end is set by the 04 cycle
        billingCycleAnchor: anchor,
        nextBillingAt: anchor,
        trialStart,
        trialEnd,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!sub) {
      throw AppError.InternalServerError(
        'failed to persist subscription',
        { reference },
        NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
      );
    }
    await tx.insert(subscriptionItemsTable).values({
      reference: mintReference('SBI'),
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      subscriptionId: sub.id,
      priceId: price.id,
      quantity: input.quantity,
      unitAmount: price.unitAmount,
    });
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.created',
    payload: { reference, status, customerRef: input.customerRef, priceRef: input.priceRef },
  });

  return getSubscriptionByReference(txDb, ctx, reference);
}
