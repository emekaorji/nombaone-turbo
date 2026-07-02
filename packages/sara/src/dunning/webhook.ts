import { and, eq } from 'drizzle-orm';

import { dunningAttemptsTable, invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';

import { confirmInvoiceFromWebhook } from '../billing/confirmInvoiceFromWebhook';
import { loadSubscriptionRowById } from '../billing/effects';
import { emitEvent } from '../events';
import { coerceFailureReason } from '../nomba/failure-taxonomy';
import { extractOurReference, extractProviderTransactionId } from '../payment-methods';
import { recordOutcome } from './attempt';

import type { NombaClient } from '../nomba/client';
import type { DomainContext, InfraTxDb } from '../context';

export interface InboundDunningResult {
  matched: boolean;
  handled: boolean;
  settled?: boolean;
}

async function loadInvoiceById(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string
): Promise<InvoiceRow | null> {
  const [row] = await txDb
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.environment, ctx.environment),
        eq(invoicesTable.id, invoiceId)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * The ASYNC dunning bridge (item 9). A dunning retry charges the rail keyed on the
 * ATTEMPT's `DUN` reference, so a real card's later `payment_success`/`payment_failed`
 * webhook carries that `DUN` ref — which the invoice-settlement path can't match
 * (it's not an invoice ref). Without this, a paid async retry is never recorded and
 * dunning loops to exhaustion. Here we resolve the attempt by its reference, requery
 * Nomba (E4 — never trust the webhook), and:
 *  • settled + amount matches the outstanding → settle the invoice
 *    (`confirmInvoiceFromWebhook` claims + posts + recovers), mark the attempt
 *    `succeeded`, emit `invoice.payment_recovered`;
 *  • definitively failed → drive the normal `recordOutcome` branch (classify →
 *    reschedule / short-path / card-update, honoring exhaustion);
 *  • pending / already-paid → no-op (a later webhook or the sweep resolves it).
 * Idempotent: `claimInvoicePaid`'s CAS (inside confirm) settles at most once.
 */
export async function processInboundDunningEvent(
  txDb: InfraTxDb,
  client: NombaClient,
  input: { requestId: string; eventType: string; payload: Record<string, unknown> }
): Promise<InboundDunningResult> {
  const reference = extractOurReference(input.payload);
  if (!reference) return { matched: false, handled: false };

  const [attempt] = await txDb
    .select()
    .from(dunningAttemptsTable)
    .where(eq(dunningAttemptsTable.reference, reference))
    .limit(1);
  if (!attempt) return { matched: false, handled: false };

  const ctx: DomainContext = {
    organizationId: attempt.organizationId,
    environment: attempt.environment,
  };
  const invoice = await loadInvoiceById(txDb, ctx, attempt.invoiceId);
  if (!invoice) return { matched: true, handled: false };
  const sub = await loadSubscriptionRowById(txDb, ctx, attempt.subscriptionId);
  const outstanding = invoice.amountDue - invoice.amountPaid;

  // E4 requery keys on the NOMBA transaction id (our DUN ref 404s); pull it from the payload.
  const providerTxnId = extractProviderTransactionId(input.payload);
  const requery = await client.requeryTransaction(ctx, { reference: providerTxnId ?? reference });

  // Verified SUCCESS → settle + recover + mark the attempt recovered.
  if (requery.succeeded && (requery.amount ?? 0) === outstanding && !invoice.paidAt) {
    const { settled } = await confirmInvoiceFromWebhook(txDb, ctx, invoice.reference, {
      status: 'settled',
      settledAmountKobo: outstanding,
      providerReference: requery.providerReference,
    });
    if (settled) {
      await txDb
        .update(dunningAttemptsTable)
        .set({ status: 'succeeded', outcome: 'recovered' })
        .where(eq(dunningAttemptsTable.id, attempt.id));
      await emitEvent(txDb, {
        ...ctx,
        type: 'invoice.payment_recovered',
        payload: { reference: invoice.reference },
      });
    }
    return { matched: true, handled: true, settled };
  }

  // Verified FAILURE (found, not succeeded, not pending) → drive the dunning branch.
  if (requery.found && !requery.succeeded && requery.status !== 'pending' && !invoice.paidAt) {
    await recordOutcome(txDb, ctx, {
      attempt,
      sub,
      invoice,
      charge: {
        outcome: 'failed',
        reason: coerceFailureReason(requery.gatewayMessage),
        gatewayMessage: requery.gatewayMessage ?? null,
        invoice,
      },
    });
    return { matched: true, handled: true, settled: false };
  }

  // Pending / already-settled / not-yet-visible → no-op.
  return { matched: true, handled: true, settled: false };
}
