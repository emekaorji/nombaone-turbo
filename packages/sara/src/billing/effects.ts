import { and, desc, eq } from 'drizzle-orm';

import {
  paymentMethodsTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
  type InvoiceRow,
  type PaymentMethodRow,
  type PriceRow,
  type SubscriptionItemRow,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { getDefaultForCustomer } from '../payment-methods';
import { activateSubscription, recoverFromPastDue } from '../subscriptions';
import { advancePeriod } from './period';

import type { DomainContext, InfraTxDb } from '../context';

/** Map a payment method's kind to the rail key the registry resolves (never a name). */
const RAIL_KEY_BY_KIND: Record<PaymentMethodRow['kind'], string> = {
  card: 'card',
  mandate: 'mandate',
  virtual_account: 'transfer',
};
export function railKeyForMethod(kind: PaymentMethodRow['kind']): string {
  return RAIL_KEY_BY_KIND[kind];
}

export async function loadSubscriptionRowById(
  txDb: InfraTxDb,
  ctx: DomainContext,
  id: string
): Promise<SubscriptionRow> {
  const [row] = await txDb
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.environment, ctx.environment),
        eq(subscriptionsTable.id, id)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound('subscription not found', { id }, NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND);
  }
  return row;
}

export async function loadPriceById(
  txDb: InfraTxDb,
  ctx: DomainContext,
  id: string
): Promise<PriceRow> {
  const [row] = await txDb
    .select()
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.environment, ctx.environment),
        eq(pricesTable.id, id)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound('price not found', { id }, NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND);
  }
  return row;
}

export async function loadPrimarySubscriptionItem(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionId: string
): Promise<SubscriptionItemRow> {
  const [row] = await txDb
    .select()
    .from(subscriptionItemsTable)
    .where(
      and(
        eq(subscriptionItemsTable.organizationId, ctx.organizationId),
        eq(subscriptionItemsTable.environment, ctx.environment),
        eq(subscriptionItemsTable.subscriptionId, subscriptionId)
      )
    )
    .orderBy(desc(subscriptionItemsTable.createdAt))
    .limit(1);
  if (!row) {
    throw AppError.UnprocessableEntity(
      'subscription has no item to bill',
      { subscriptionId },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }
  return row;
}

/** The subscription's charge method: its pinned default, else the customer's default. */
export async function resolveCollectionMethod(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<PaymentMethodRow | null> {
  if (sub.defaultPaymentMethodId) {
    const [row] = await txDb
      .select()
      .from(paymentMethodsTable)
      .where(
        and(
          eq(paymentMethodsTable.organizationId, ctx.organizationId),
          eq(paymentMethodsTable.environment, ctx.environment),
          eq(paymentMethodsTable.id, sub.defaultPaymentMethodId)
        )
      )
      .limit(1);
    if (row) return row;
  }
  return getDefaultForCustomer(txDb, ctx, sub.customerId);
}

/**
 * The paid-side FSM effects shared by `collectForInvoice` (PULL succeeded) and
 * `confirmInvoiceFromWebhook` (inbound settled): activate the subscription
 * (`incomplete`/`trialing → active`, A7) or recover it (`past_due → active`), then
 * advance the period to the just-paid window. Idempotent — re-running on an
 * already-active sub is a no-op transition.
 */
export async function applyPaidSubEffects(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  if (!invoice.subscriptionId) return;
  let sub = await loadSubscriptionRowById(txDb, ctx, invoice.subscriptionId);
  if (sub.status === 'incomplete' || sub.status === 'trialing') {
    sub = await activateSubscription(txDb, ctx, sub);
  } else if (sub.status === 'past_due') {
    sub = await recoverFromPastDue(txDb, ctx, sub);
  }
  if (invoice.periodStart && invoice.periodEnd) {
    await advancePeriod(txDb, ctx, sub, invoice.periodStart, invoice.periodEnd);
  }
}
