import { and, eq } from 'drizzle-orm';

import { paymentMethodsTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { getSubscriptionByReference, loadSubscriptionRow } from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { SubscriptionResponseData } from './types';

export interface UpdateSubscriptionInput {
  defaultPaymentMethodRef?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generic field update — `default_payment_method_id` and `metadata` only.
 * Lifecycle changes (cancel/pause/resume) go through the dedicated action ops, not
 * here. Written under the optimistic `version` guard; emits `subscription.updated`.
 */
export async function updateSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: UpdateSubscriptionInput
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);

  const set: { version: number; defaultPaymentMethodId?: string; metadata?: Record<string, unknown> } = {
    version: sub.version + 1,
  };

  if (input.defaultPaymentMethodRef !== undefined) {
    const [pm] = await txDb
      .select({ id: paymentMethodsTable.id })
      .from(paymentMethodsTable)
      .where(
        and(
          eq(paymentMethodsTable.organizationId, ctx.organizationId),
          eq(paymentMethodsTable.mode, ctx.mode),
          eq(paymentMethodsTable.reference, input.defaultPaymentMethodRef)
        )
      )
      .limit(1);
    if (!pm) {
      throw AppError.NotFound(
        'payment method not found',
        { reference: input.defaultPaymentMethodRef },
        NOMBAONE_ERROR_CODES.PAYMENT_METHOD_NOT_FOUND
      );
    }
    set.defaultPaymentMethodId = pm.id;
  }

  if (input.metadata !== undefined) {
    set.metadata = input.metadata;
  }

  const [updated] = await txDb
    .update(subscriptionsTable)
    .set(set)
    .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
    .returning();
  if (!updated) {
    throw AppError.Conflict(
      'subscription was modified concurrently; retry',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'subscription.updated', payload: { reference } });
  return getSubscriptionByReference(txDb, ctx, reference);
}
