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
import { periodBounds, reanchorForIntervalSwitch } from './scheduling';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

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
        eq(subscriptionsTable.mode, ctx.mode),
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
        eq(pricesTable.mode, ctx.mode),
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
        eq(subscriptionItemsTable.mode, ctx.mode),
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

/**
 * The subscription's charge method: its pinned default, else the customer's
 * default. A `send_invoice` subscription is NEVER auto-pulled — it is always left
 * `open` to await an inbound transfer, regardless of any pinned/default method.
 */
export async function resolveCollectionMethod(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<PaymentMethodRow | null> {
  if (sub.collectionMethod === 'send_invoice') return null;
  if (sub.defaultPaymentMethodId) {
    const [row] = await txDb
      .select()
      .from(paymentMethodsTable)
      .where(
        and(
          eq(paymentMethodsTable.organizationId, ctx.organizationId),
          eq(paymentMethodsTable.mode, ctx.mode),
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
 * advance the period to the just-paid window. **Fully idempotent** — re-running on
 * an already-active sub is a no-op transition, and the period advance fires ONLY
 * while the sub is still at the invoice's period (`currentPeriodIndex ===
 * invoice.periodIndex`), so re-driving after a crash/version-conflict completes the
 * advance exactly once and never double-advances (the self-heal path).
 */
export async function applyPaidSubEffects(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  if (!invoice.subscriptionId) return;
  let sub = await loadSubscriptionRowById(txDb, ctx, invoice.subscriptionId);
  const wasPastDue = sub.status === 'past_due';
  if (
    sub.status === 'incomplete' ||
    // A LATE checkout payment on an expired sub — resurrect; we never keep the
    // money AND the expiry (fsm edge incomplete_expired → active).
    sub.status === 'incomplete_expired' ||
    sub.status === 'trialing'
  ) {
    sub = await activateSubscription(txDb, ctx, sub);
  } else if (sub.status === 'past_due') {
    sub = await recoverFromPastDue(txDb, ctx, sub);
  }
  if (invoice.periodStart && invoice.periodEnd && sub.currentPeriodIndex === invoice.periodIndex) {
    await advancePeriod(txDb, ctx, sub, invoice.periodStart, invoice.periodEnd);
  }
  if (wasPastDue) {
    await forgiveElapsedUnservedPeriods(txDb, ctx, invoice.subscriptionId);
  }
}

/**
 * RECOVERY FORGIVENESS (money-safety). A `past_due` subscription is invisible to
 * the renewal sweep, so real time passes while dunning runs — on a 10-minute
 * plan with the default 24h first retry that is ~144 whole periods. Without
 * this, the drain loop BACK-BILLED every one of them the moment the customer
 * recovered: paying one failed invoice bought a stack of invoices for service
 * never rendered. The deal is: pay the failed period once, service resumes NOW —
 * so after recovery the anchor is shifted forward until the CURRENT period
 * contains this instant (`reanchorForIntervalSwitch` keeps `current_period_index`
 * monotonic, so the invoice-per-period uniqueness cannot collide). A no-op when
 * the sub is not actually behind (a fast recovery inside one period).
 */
async function forgiveElapsedUnservedPeriods(
  txDb: InfraTxDb,
  ctx: DomainContext,
  subscriptionId: string
): Promise<void> {
  const sub = await loadSubscriptionRowById(txDb, ctx, subscriptionId);
  if (sub.status !== 'active') return;
  if (!sub.nextBillingAt || sub.nextBillingAt.getTime() > Date.now()) return; // not behind

  const price = await loadPriceById(txDb, ctx, sub.priceId);
  const cadence = { interval: price.interval, intervalCount: price.intervalCount };
  const re = reanchorForIntervalSwitch(new Date(), sub.currentPeriodIndex, cadence);
  const bounds = periodBounds(re.anchor, cadence, sub.currentPeriodIndex);
  await txDb
    .update(subscriptionsTable)
    .set({
      billingCycleAnchor: re.anchor,
      currentPeriodStart: re.currentPeriodStart,
      currentPeriodEnd: bounds.start,
      nextBillingAt: bounds.start,
    })
    .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)));
}

/**
 * Best-effort self-heal of a paid-but-not-advanced subscription, for the
 * already-paid replay paths (runCycle's `paidAt` early-return, confirm's terminal
 * return). Swallows a `SUBSCRIPTION_VERSION_CONFLICT`: a conflict means a CONCURRENT
 * flow is already advancing the subscription, so the heal is redundant — not an
 * error. Any other failure propagates.
 */
export async function reconcilePaidSubEffects(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  try {
    await applyPaidSubEffects(txDb, ctx, invoice);
  } catch (error) {
    if ((error as { code?: string }).code !== NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT) {
      throw error;
    }
  }
}
