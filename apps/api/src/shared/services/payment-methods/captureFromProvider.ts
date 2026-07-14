import { and, eq } from 'drizzle-orm';

import { customersTable, paymentMethodsTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';

import { getBillingNombaClient } from '@nombaone/sara/nomba/injected';

import { logger } from '@shared/observability/logger';

import { flipToSendInvoiceIfUnchargeable } from './captureFromInvoice';

import type { InvoiceRow, PaymentMethodRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * ── PULL THE CARD TOKEN INSTEAD OF WAITING FOR IT ────────────────────────────
 *
 * `captureCardFromInvoicePayment` reads the token out of the `payment_success` webhook payload.
 * That is the happy path, and it is the ONLY path we had.
 *
 * On live it produced nothing at all. Nomba tokenized the customer's card exactly as advertised —
 * and then never called our webhook, so the token was never delivered, so a `charge_automatically`
 * subscription was left with `default_payment_method_id = null`. The consequence is not subtle: the
 * renewal has nothing to charge, so every cycle degrades into "here is another checkout link,
 * please pay by hand" — which is the precise opposite of the product.
 *
 * A webhook is a NOTIFICATION, not a source of truth. Nomba will hand us the token whenever we ask
 * (`GET /v1/checkout/tokenized-card-data?customerEmail=…`, verified live), so after a settled
 * card payment we ask, rather than assuming a message we never received.
 *
 * Deliberately runs on the POOL handle, outside any transaction: it makes a network call, and a
 * remote round-trip inside an open transaction holds locks for as long as the other end feels like
 * taking. The writes are idempotent on (customer, tokenKey) — so it is safe to re-run, safe to run
 * alongside the webhook path if the webhook ever does show up, and a crash between the insert and
 * the subscription pin is repaired by the next run rather than duplicating a card.
 */

const last4Of = (masked: string | undefined): string | null => {
  const digits = (masked ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/** Nomba gives expiry as `MMYY` (`3008` = 08/2030) — NOT `YYMM`. */
function expiryOf(mmyy: string | undefined): { month: number | null; year: number | null } {
  if (!mmyy || !/^\d{4}$/.test(mmyy)) return { month: null, year: null };
  const month = Number(mmyy.slice(0, 2));
  const year = 2000 + Number(mmyy.slice(2));
  if (month < 1 || month > 12) return { month: null, year: null };
  return { month, year };
}

/**
 * After a card payment settles, make sure the subscription actually HAS a card.
 *
 * No-ops when the subscription already has one, when the org has no Nomba credentials, or when
 * Nomba holds no token for the customer (they paid by transfer/USSD — that case is handled by
 * `flipToSendInvoiceIfUnchargeable`, which routes them to the invoice lane instead of failing them
 * on a card they never gave us).
 */
export async function captureCardFromProvider(
  db: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<{ captured: boolean; method: PaymentMethodRow | null }> {
  if (!invoice.subscriptionId) return { captured: false, method: null };

  // The INJECTED client, not one pulled out of app config. A service that reaches into
  // `@shared/config/*` drags `env.ts` — and its `dotenv` side-effect — into every module that
  // imports this barrel, which is enough to change what a test's environment resolves to. It also
  // inverts the layering the rest of the money path uses: the app registers a client factory at
  // boot, and services ask the registry.
  const client = getBillingNombaClient(ctx.mode);
  if (!client) return { captured: false, method: null }; // Nomba unconfigured for this mode

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        eq(subscriptionsTable.id, invoice.subscriptionId)
      )
    )
    .limit(1);

  if (!sub || sub.collectionMethod !== 'charge_automatically') {
    return { captured: false, method: null };
  }
  if (sub.defaultPaymentMethodId) return { captured: false, method: null }; // already chargeable

  const [customer] = await db
    .select({ email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, invoice.customerId))
    .limit(1);

  const email = customer?.email;
  if (!email) return { captured: false, method: null };

  let cards;
  try {
    cards = await client.listTokenizedCards(ctx, { customerEmail: email });
  } catch (error) {
    // Never fail a settled payment because the token lookup did. The money is banked; the worst
    // case is that this subscription stays uncharge­able until the next attempt re-runs this.
    logger.warn('[cards] tokenized-card lookup failed', {
      invoice: invoice.reference,
      error: error instanceof Error ? error.message : String(error),
    });
    return { captured: false, method: null };
  }

  // Newest last in Nomba's list; take the most recent, which is the card they just paid with.
  const card = cards.at(-1);
  if (!card) return { captured: false, method: null };

  const { month, year } = expiryOf(card.tokenExpiryDate);

  // Idempotent on (customer, tokenKey) — a re-run, or the webhook path arriving late, reuses the
  // existing row rather than minting a duplicate card (partial unique index, migration 0023).
  const [existing] = await db
    .select()
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.organizationId, ctx.organizationId),
        eq(paymentMethodsTable.mode, ctx.mode),
        eq(paymentMethodsTable.customerId, invoice.customerId),
        eq(paymentMethodsTable.tokenKey, card.tokenKey)
      )
    )
    .limit(1);

  const method =
    existing ??
    (
      await db
        .insert(paymentMethodsTable)
        .values({
          reference: mintReference('PMT'),
          organizationId: ctx.organizationId,
          mode: ctx.mode,
          customerId: invoice.customerId,
          kind: 'card',
          status: 'active',
          tokenKey: card.tokenKey,
          brand: card.cardType ?? null,
          last4: last4Of(card.cardPan),
          expMonth: month,
          expYear: year,
        })
        .returning()
    )[0];

  if (!method) return { captured: false, method: null };

  // Pin it on the SUBSCRIPTION, not as the customer default: it wins in `resolveCollectionMethod`
  // and cannot collide with the partial unique index on the customer default, so a customer with
  // several subscriptions can pay each with a different card.
  await db
    .update(subscriptionsTable)
    .set({ defaultPaymentMethodId: method.id })
    .where(eq(subscriptionsTable.id, sub.id));

  if (!existing) {
    await emitEvent(db, {
      ...ctx,
      type: 'payment_method.attached',
      payload: { reference: method.reference, kind: 'card', status: 'active' },
    });
  }

  logger.info('[cards] pulled tokenized card from Nomba', {
    invoice: invoice.reference,
    subscription: sub.reference,
    method: method.reference,
    brand: method.brand,
    last4: method.last4,
  });

  return { captured: true, method };
}

/**
 * The post-settlement question, asked once, from every settle path: **can we charge this
 * subscription next time?**
 *
 * Order matters, and it is the whole point of this function. `flipToSendInvoiceIfUnchargeable`
 * demotes a subscription to the pay-by-link lane when it has no card — which is right for someone
 * who paid by transfer, and WRONG for someone who paid by card whose token we simply hadn't
 * fetched yet. So we ask Nomba for the token FIRST, and only demote a customer once we know there
 * is genuinely no card to charge.
 *
 * Runs after the settling write has committed, because it makes a network call.
 */
export async function ensureSubscriptionChargeable(
  db: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  const pulled = await captureCardFromProvider(db, ctx, invoice);
  if (pulled.captured) return;

  await flipToSendInvoiceIfUnchargeable(db, ctx, invoice);
}
