import { eq, sql } from 'drizzle-orm';

import { invoicesTable } from '@nombaone/core-db/schema';
import { markInboundEvent, recordInboundEvent, type NombaClientFactory } from '@nombaone/sara/nomba';

import { closeHeldAttemptsForInvoice } from '../dunning/attempt';
import {
  captureCardFromInvoicePayment,
  extractOurReference,
  extractProviderTransactionId,
  flipToSendInvoiceIfUnchargeable,
} from '../payment-methods';
import { OTP_ORDER_REF_SUFFIX } from './actionLink';
import { failCollection } from './collectForInvoice';
import { confirmInvoiceFromWebhook } from './confirmInvoiceFromWebhook';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { InboundVerification } from './types';

/** Nomba event names that mean "this payment did not happen". */
const FAILURE_EVENTS = new Set(['payment_failed', 'payment_reversed']);

/** Nomba's human failure text, wherever it hides in the payload. */
function extractGatewayMessage(payload: Record<string, unknown>): string | undefined {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const txn = (data.transaction ?? {}) as Record<string, unknown>;
  for (const v of [txn.gatewayMessage, txn.responseMessage, txn.message, data.message]) {
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

/**
 * An inbound event said the payment FAILED. Put the invoice into exactly the state a
 * synchronous failure would have, so dunning starts.
 *
 * ⚠ E4 — we never take the webhook's word for it. Two conditions must BOTH hold:
 *   1. Nomba explicitly signalled a failure event, and
 *   2. our own requery did NOT say the transaction succeeded.
 * `requery.succeeded` always wins, so a slow-settling payment can never be dunned, and a
 * spoofed/replayed "failed" cannot cancel a customer who actually paid.
 *
 * Doing nothing (the old behaviour) meant a declined renewal left the subscription
 * `active` and unpaid forever — free service, no dunning, no churn.
 */
async function handleInboundFailure(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: {
    invoice: InvoiceRow;
    eventType: string;
    requerySucceeded: boolean;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  if (!FAILURE_EVENTS.has(input.eventType)) return; // merely pending/unknown — leave it open
  if (input.requerySucceeded) return; // the provider says it DID settle — never dun a payer

  const { invoice } = input;
  // Terminal or already-paid invoices are none of this path's business.
  if (invoice.paidAt || invoice.voidedAt || invoice.uncollectibleAt) return;

  // Same helper the synchronous path uses: bumps the attempt, records the reason, moves
  // the subscription to `past_due`, emits `invoice.payment_failed`. The dunning sweep then
  // schedules attempt #1 and the ladder takes over.
  await failCollection(txDb, ctx, invoice, extractGatewayMessage(input.payload));
}

export interface InboundInvoiceResult {
  /** false ⇒ this inbound event is not for an invoice — the caller should fall
   *  through to the payment-method inbound path. */
  matched: boolean;
  handled: boolean;
  firstSeen?: boolean;
  settled?: boolean;
}

/**
 * Route a verified inbound Nomba event to invoice settlement when OUR reference in
 * the payload resolves to an invoice (a push-rail transfer, or an async pull,
 * landing). Resolves the owning tenant from the invoice, **requeries Nomba**
 * (E4 — never trust the webhook body), then `confirmInvoiceFromWebhook` settles
 * (idempotently, J6), and the event is durably de-duplicated
 * (`unique(provider, request_id)`). Returns `matched: false` when the reference is
 * not an invoice, so the worker falls through to the payment-method path.
 */
export async function processInboundInvoiceEvent(
  txDb: InfraTxDb,
  getClient: NombaClientFactory,
  input: { requestId: string; eventType: string; payload: Record<string, unknown> }
): Promise<InboundInvoiceResult> {
  const rawReference = extractOurReference(input.payload);
  if (!rawReference) return { matched: false, handled: false };
  // An OTP/3DS-completion checkout carries `${invoice.reference}-otp` (a distinct
  // order ref that dodged Nomba's dedup on the original charge). Strip the suffix so
  // it settles the SAME invoice. Our refs have no hyphens, so the tail is unambiguous.
  const reference = rawReference.endsWith(OTP_ORDER_REF_SUFFIX)
    ? rawReference.slice(0, -OTP_ORDER_REF_SUFFIX.length)
    : rawReference;

  // The FULL row — the failure leg needs paidAt/voidedAt/attemptCount, not just the ids.
  const [inv] = await txDb
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.reference, reference))
    .limit(1);
  if (!inv) return { matched: false, handled: false };

  const ctx: DomainContext = { organizationId: inv.organizationId, mode: inv.mode };
  // Resolve the Nomba client for the invoice's OWN mode — a live invoice requeries
  // live Nomba, a sandbox invoice sandbox Nomba (one endpoint receives both).
  const client = getClient(ctx.mode);

  // E4 — re-verify against the provider; the webhook is only a hint. Requery keys on the
  // NOMBA transaction id (live-confirmed: our reference 404s), so pull it from the payload.
  const providerTxnId = extractProviderTransactionId(input.payload);
  if (providerTxnId) {
    // Stamp it durably: this id is the ONLY key the nightly reconcile backstop can
    // requery by. Any webhook naming the invoice donates it — even a payment_failed
    // (the id still resolves and lets reconcile see the terminal state).
    await txDb
      .update(invoicesTable)
      .set({
        metadata: sql`COALESCE(${invoicesTable.metadata}, '{}'::jsonb) || ${JSON.stringify({ providerTransactionId: providerTxnId })}::jsonb`,
      })
      .where(eq(invoicesTable.id, inv.id));
  }
  const requery = await client.requeryTransaction(ctx, { reference: providerTxnId ?? reference });
  const verification: InboundVerification = {
    status: requery.succeeded ? 'settled' : requery.found ? 'pending' : 'failed',
    settledAmountKobo: requery.amount ?? 0,
    providerReference: requery.providerReference,
  };
  const result = await confirmInvoiceFromWebhook(txDb, ctx, reference, verification);

  // If this invoice had a HELD dunning attempt (expired-card update or an OTP/3DS
  // re-auth completed via the fresh link), close it out + emit recovery.
  if (result.settled) {
    await closeHeldAttemptsForInvoice(txDb, ctx, inv.id, reference);

    // Hosted-checkout aftermath, on the SAME webhook that settled the invoice:
    //   card payment → capture the tokenized card and pin it as the sub's
    //   method (the worker's invoice-matched branch returns before the generic
    //   payment-method settle, so without this the token was silently lost);
    //   token-less payment (transfer/USSD) → flip the sub to `send_invoice` so
    //   renewals route to the invoice-link lane instead of doomed silent pulls.
    const capture = await captureCardFromInvoicePayment(txDb, ctx, {
      invoice: result.invoice,
      payload: input.payload,
    });
    if (!capture.captured) {
      await flipToSendInvoiceIfUnchargeable(txDb, ctx, result.invoice);
    }
  } else {
    // ── 🔴 THE FAILURE LEG. Without this a declined renewal was FREE SERVICE, forever.
    //
    // On live a tokenized card charge returns `pending` — the real outcome arrives as a
    // `payment_failed` webhook. That webhook names the INVOICE, so it is matched here and
    // the worker returns early, never reaching the dunning bridge (which only handles
    // retries, keyed on a DUN attempt ref). And `confirmInvoiceFromWebhook` only acts on
    // `settled`. So the decline landed, was acknowledged, and nothing happened: the
    // invoice stayed `open`, the subscription stayed `active`, dunning never started, and
    // the customer kept their membership without paying. Every renewal decline on live
    // ended here.
    //
    // The rule is deliberately conservative — we NEVER mark a payment failed on the
    // webhook's say-so alone (E4). It must BOTH be an explicit failure event AND our own
    // requery must not contradict it. `requery.succeeded` always wins: a late-settling
    // transaction can never be dunned.
    await handleInboundFailure(txDb, ctx, {
      invoice: inv,
      eventType: input.eventType,
      requerySucceeded: requery.succeeded,
      payload: input.payload,
    });
  }

  const { firstSeen } = await recordInboundEvent(txDb, {
    mode: ctx.mode,
    provider: 'nomba',
    requestId: input.requestId,
    eventType: input.eventType,
    payload: input.payload,
    organizationId: ctx.organizationId,
  });
  await markInboundEvent(txDb, { provider: 'nomba', requestId: input.requestId, status: 'processed' });

  return { matched: true, handled: true, firstSeen, settled: result.settled };
}
