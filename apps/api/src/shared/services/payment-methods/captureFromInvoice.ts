import { and, eq } from 'drizzle-orm';

import { paymentMethodsTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';

import { logger } from '@shared/observability/logger';

import { isRealTokenKey } from './settle';


import type { InvoiceRow, PaymentMethodRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { TokenizedCardData } from './types';

const last4Of = (masked: string | undefined): string | null => {
  const digits = (masked ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};
const toInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Capture a card token that arrived on an INVOICE-keyed payment — the hosted-
 * checkout entry flow, where no `payment_methods` row exists beforehand (the
 * classic `captureCardToken` resolves by a PMT order reference and finds
 * nothing here). Creates the row `active` with the token, pins it as the paying
 * subscription's default, and emits `payment_method.attached`.
 *
 * The OLD behavior lost this token entirely: the worker's invoice-matched
 * branch returned before any payment-method settle ran, so a customer who paid
 * AND tokenized on the first checkout still had no charge­able method — every
 * renewal would re-ask them to pay by hand.
 *
 * Idempotent on (customer, tokenKey): a replayed webhook reuses the existing
 * row (backed by a partial unique index in migration 0023).
 */
export async function captureCardFromInvoicePayment(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { invoice: InvoiceRow; payload: Record<string, unknown> }
): Promise<{ captured: boolean; method: PaymentMethodRow | null }> {
  const { invoice, payload } = input;
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const tcd = data.tokenizedCardData as TokenizedCardData | undefined;

  if (!isRealTokenKey(tcd?.tokenKey)) return { captured: false, method: null };
  const tokenKey = tcd!.tokenKey;

  // Replay / duplicate-webhook guard: this customer already holds this token.
  const [existing] = await txDb
    .select()
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.organizationId, ctx.organizationId),
        eq(paymentMethodsTable.mode, ctx.mode),
        eq(paymentMethodsTable.customerId, invoice.customerId),
        eq(paymentMethodsTable.tokenKey, tokenKey)
      )
    )
    .limit(1);

  const method =
    existing ??
    (
      await txDb
        .insert(paymentMethodsTable)
        .values({
          reference: mintReference('PMT'),
          organizationId: ctx.organizationId,
          mode: ctx.mode,
          customerId: invoice.customerId,
          kind: 'card',
          status: 'active',
          tokenKey,
          brand: tcd!.cardType ?? null,
          last4: last4Of(tcd!.cardPan),
          expMonth: toInt(tcd!.tokenExpiryMonth),
          expYear: toInt(tcd!.tokenExpiryYear),
        })
        .returning()
    )[0];

  if (!method) return { captured: false, method: null };

  // Pin it as the paying subscription's method so the every-minute sweep can
  // pull renewals silently. Sub-level pin (not the customer default) — it wins
  // in resolveCollectionMethod and cannot collide with the partial unique index
  // on the customer default.
  if (invoice.subscriptionId) {
    await txDb
      .update(subscriptionsTable)
      .set({ defaultPaymentMethodId: method.id })
      .where(eq(subscriptionsTable.id, invoice.subscriptionId));
  }

  if (!existing) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'payment_method.attached',
      payload: { reference: method.reference, kind: 'card', status: 'active' },
    });
    logger.info('[inbound] captured card token from invoice payment', {
      invoice: invoice.reference,
      method: method.reference,
    });
  }

  return { captured: true, method };
}

/**
 * A settled hosted-checkout payment that yielded NO reusable credential (paid by
 * bank transfer / USSD — Nomba sends `tokenKey: "N/A"`): a `charge_automatically`
 * subscription with nothing to charge would fail its every renewal with a
 * spurious decline. Flip it to `send_invoice` so renewals route into the
 * invoice-plus-payment-link lane — the honest cadence for a push-paying customer.
 */
export async function flipToSendInvoiceIfUnchargeable(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<boolean> {
  if (!invoice.subscriptionId) return false;

  const [sub] = await txDb
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
  if (!sub || sub.collectionMethod !== 'charge_automatically') return false;
  if (sub.defaultPaymentMethodId) return false; // a method exists — silent pull works

  // The customer may still hold an active default method (attached earlier via
  // setupCard); only a truly method-less sub flips.
  const [anyActive] = await txDb
    .select({ id: paymentMethodsTable.id })
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.organizationId, ctx.organizationId),
        eq(paymentMethodsTable.mode, ctx.mode),
        eq(paymentMethodsTable.customerId, sub.customerId),
        eq(paymentMethodsTable.status, 'active'),
        eq(paymentMethodsTable.isDefault, true)
      )
    )
    .limit(1);
  if (anyActive) return false;

  await txDb
    .update(subscriptionsTable)
    .set({ collectionMethod: 'send_invoice' })
    .where(eq(subscriptionsTable.id, sub.id));
  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference: sub.reference, collectionMethod: 'send_invoice' },
  });
  logger.info('[inbound] flipped tokenless subscription to send_invoice', {
    subscription: sub.reference,
    invoice: invoice.reference,
  });
  return true;
}
