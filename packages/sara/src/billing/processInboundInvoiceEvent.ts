import { eq } from 'drizzle-orm';

import { invoicesTable } from '@nombaone/core-db/schema';

import { markInboundEvent, recordInboundEvent, type NombaClient } from '../nomba';
import { extractOurReference } from '../payment-methods';
import { confirmInvoiceFromWebhook } from './confirmInvoiceFromWebhook';

import type { DomainContext, InfraTxDb } from '../context';
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
  client: NombaClient,
  input: { requestId: string; eventType: string; payload: Record<string, unknown> }
): Promise<InboundInvoiceResult> {
  const reference = extractOurReference(input.payload);
  if (!reference) return { matched: false, handled: false };

  const [inv] = await txDb
    .select({
      organizationId: invoicesTable.organizationId,
      environment: invoicesTable.environment,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.reference, reference))
    .limit(1);
  if (!inv) return { matched: false, handled: false };

  const ctx: DomainContext = { organizationId: inv.organizationId, environment: inv.environment };

  // E4 — re-verify against the provider; the webhook is only a hint.
  const requery = await client.requeryTransaction(ctx, { reference });
  const verification: InboundVerification = {
    status: requery.succeeded ? 'settled' : requery.found ? 'pending' : 'failed',
    settledAmountKobo: requery.amount ?? 0,
    providerReference: requery.providerReference,
  };
  const result = await confirmInvoiceFromWebhook(txDb, ctx, reference, verification);

  const { firstSeen } = await recordInboundEvent(txDb, {
    environment: ctx.environment,
    provider: 'nomba',
    requestId: input.requestId,
    eventType: input.eventType,
    payload: input.payload,
    organizationId: ctx.organizationId,
  });
  await markInboundEvent(txDb, { provider: 'nomba', requestId: input.requestId, status: 'processed' });

  return { matched: true, handled: true, firstSeen, settled: result.settled };
}
