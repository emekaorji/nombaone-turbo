import { eq } from 'drizzle-orm';

import { invoicesTable } from '@nombaone/core-db/schema';

import { closeHeldAttemptsForInvoice } from '../dunning/attempt';
import { markInboundEvent, recordInboundEvent, type NombaClientFactory } from '@nombaone/sara/nomba';
import { extractOurReference, extractProviderTransactionId } from '../payment-methods';
import { OTP_ORDER_REF_SUFFIX } from './actionLink';
import { confirmInvoiceFromWebhook } from './confirmInvoiceFromWebhook';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { InboundVerification } from './types';

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

  const [inv] = await txDb
    .select({
      id: invoicesTable.id,
      organizationId: invoicesTable.organizationId,
      mode: invoicesTable.mode,
    })
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
