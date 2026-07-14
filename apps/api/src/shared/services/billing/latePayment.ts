import { eq } from 'drizzle-orm';

import { customersTable, invoicesTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { emitEvent } from '@nombaone/sara/events';

import { grantCredit } from '../credits';
import { logger } from '@shared/observability/logger';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * ── MONEY THAT ARRIVES AFTER WE STOPPED ASKING FOR IT ────────────────────────
 *
 * An invoice can reach a terminal state with money still owed:
 *
 *   • `uncollectible_at` — WE gave up. Dunning exhausted its ladder and churned the subscription.
 *   • `voided_at`        — the MERCHANT cancelled the invoice. It should not have been payable.
 *
 * A payment can still land afterwards, and on live it easily does: the pay-link dunning handed the
 * customer stays valid at Nomba after the ladder runs out, so a customer who pays an hour late pays
 * into an invoice we have already written off.
 *
 * The old code returned `{ settled: false }` and did nothing at all. Its comment said such a payment
 * "is an out-of-band credit, not a settlement of the terminal invoice" — but nothing anywhere
 * created that credit. So the customer was charged, the merchant was never paid, the ledger never
 * moved, and the money simply ceased to exist as far as this system was concerned. There is no
 * failure mode worse than that in a billing engine, and it was one `return` statement.
 *
 * The two terminal states genuinely deserve different answers, and neither of them is "nothing":
 */

/**
 * WE gave up; the customer did not. Paying an uncollectible invoice IS collecting it — that is the
 * whole thing we spent four dunning attempts trying to make happen. So un-write-off the invoice and
 * let the normal settlement path run: the merchant gets credited, the ledger balances, and the
 * subscription comes back (below).
 *
 * Deliberately NOT applied to a VOIDED invoice: the merchant explicitly cancelled that one, and
 * resurrecting a bill they cancelled would be us overruling them.
 */
export async function reopenUncollectibleForPayment(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<InvoiceRow> {
  const [reopened] = await txDb
    .update(invoicesTable)
    .set({ uncollectibleAt: null })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();

  logger.info('[billing] payment arrived for a written-off invoice; reopening it', {
    invoice: invoice.reference,
  });

  return reopened ?? invoice;
}

/**
 * The subscription dunning churned for THIS invoice, brought back because the invoice it churned
 * over has now been paid. The customer paid for the period; they get the period.
 *
 * Only reverses a cancellation dunning itself caused (`canceled` with the churned invoice still
 * unpaid at the time). A subscription the CUSTOMER cancelled is never resurrected by a late payment
 * — that would be re-subscribing someone who asked to leave.
 */
export async function reviveChurnedSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  if (!invoice.subscriptionId) return;

  const [sub] = await txDb
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, invoice.subscriptionId))
    .limit(1);

  if (!sub || sub.status !== 'canceled') return;
  // `cancelAtPeriodEnd` marks a customer-initiated wind-down. Dunning's churn does not set it, so
  // this is how we tell "we cancelled them for not paying" from "they asked to leave".
  if (sub.cancelAtPeriodEnd) return;

  await txDb
    .update(subscriptionsTable)
    .set({ status: 'active', canceledAt: null })
    .where(eq(subscriptionsTable.id, sub.id));

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.activated',
    payload: { reference: sub.reference, status: 'active' },
  });

  logger.info('[billing] revived a churned subscription — its invoice was paid after all', {
    subscription: sub.reference,
    invoice: invoice.reference,
  });
}

/**
 * The MERCHANT voided this invoice, and money turned up for it anyway. We must not settle a bill the
 * merchant cancelled — but we absolutely must not keep the money either. Bank it as customer credit,
 * which the next invoice consumes oldest-first.
 *
 * Idempotent on the invoice reference: a redelivered webhook cannot grant the credit twice.
 */
export async function creditPaymentOnVoidedInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  amountKobo: number
): Promise<void> {
  if (amountKobo <= 0) return;

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, invoice.customerId))
    .limit(1);
  if (!customer) return;

  await grantCredit(txDb, ctx, {
    customerRef: customer.reference,
    amount: amountKobo,
    source: 'goodwill',
    // The invoice reference makes the grant idempotent: a redelivered webhook for the same voided
    // invoice reuses the grant instead of minting a second one and paying the customer twice.
    sourceReference: invoice.reference,
    metadata: { reason: 'payment_received_on_voided_invoice' },
  });

  logger.warn('[billing] payment landed on a VOIDED invoice; banked as customer credit', {
    invoice: invoice.reference,
    amountKobo,
  });
}
