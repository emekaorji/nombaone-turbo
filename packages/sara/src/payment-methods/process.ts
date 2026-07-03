import { eq, or } from 'drizzle-orm';

import { paymentMethodsTable } from '@nombaone/core-db/schema';

import { markInboundEvent, recordInboundEvent } from '../nomba/ingest';
import { settleInboundEvent } from './settle';

import type { DomainContext, Environment, InfraDb, InfraTxDb } from '../context';

/** Pull OUR stable reference out of a Nomba inbound payload (order ref / VA alias).
 *  Live prod (2026-07-01) confirmed the join field: our reference comes back as
 *  `orderReference` (checkout callback) and, on the transaction record, as
 *  `onlineCheckoutOrderReference`; Nomba's own id is `orderId`/`onlineCheckoutOrderId`.
 *  We check every known carrier so whatever shape the webhook uses, we resolve. */
export function extractOurReference(payload: Record<string, unknown>): string | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const order = (data.order ?? {}) as Record<string, unknown>;
  const txn = (data.transaction ?? {}) as Record<string, unknown>;
  const candidates = [
    data.orderReference,
    order.orderReference,
    // card/checkout transaction record (live-confirmed field)
    txn.onlineCheckoutOrderReference,
    data.onlineCheckoutOrderReference,
    data.merchantTxRef,
    txn.merchantTxRef,
    txn.merchantReference,
    data.merchantReference,
    // transfer / virtual-account funding
    txn.aliasAccountReference,
    data.aliasAccountReference,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

/** The NOMBA transaction id from an inbound payload — the key `requeryTransaction` accepts.
 *  Live-confirmed (2026-07-02): requery by our `orderReference`/`merchantTxRef`/order UUID all
 *  404; only `data.transaction.transactionId` (e.g. `WEB-ONLINE_C-…`) returns the transaction.
 *  So E4 re-verification must requery by THIS, not our reference. */
export function extractProviderTransactionId(payload: Record<string, unknown>): string | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const txn = (data.transaction ?? {}) as Record<string, unknown>;
  const candidates = [txn.transactionId, data.transactionId, txn.id, data.id];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

/** Resolve the (org, env) that owns a reference (payment-method ref or VA accountRef). */
export async function resolveScopeByReference(
  db: InfraDb,
  reference: string
): Promise<{ organizationId: string; environment: Environment } | null> {
  const [row] = await db
    .select({
      organizationId: paymentMethodsTable.organizationId,
      environment: paymentMethodsTable.environment,
    })
    .from(paymentMethodsTable)
    .where(or(eq(paymentMethodsTable.reference, reference), eq(paymentMethodsTable.accountRef, reference)))
    .limit(1);
  return row ?? null;
}

/**
 * Process ONE verified inbound Nomba event (what the inbound-webhook worker runs).
 * Resolves the owning tenant from OUR reference in the payload, then **settles
 * (idempotently) and records** on the pool handle: `settleInboundEvent`'s capture
 * is a no-op on an already-active method, and `recordInboundEvent`'s
 * `unique(provider, request_id)` guarantees exactly one event row (F2). So a
 * redelivery — or an out-of-order duplicate (F4) — has exactly one effect.
 */
export async function processInboundNombaEvent(
  txDb: InfraTxDb,
  input: { requestId: string; eventType: string; payload: Record<string, unknown> }
): Promise<{ handled: boolean; firstSeen: boolean; outcome?: 'captured' | 'recorded' | 'ignored' }> {
  const reference = extractOurReference(input.payload);
  const scope = reference ? await resolveScopeByReference(txDb, reference) : null;

  if (!scope) {
    // We cannot attribute the event to a tenant — record it (org-less) for audit
    // so it is still de-duplicated, and ack.
    const { firstSeen } = await recordInboundEvent(txDb, {
      environment: 'test',
      provider: 'nomba',
      requestId: input.requestId,
      eventType: input.eventType,
      payload: input.payload,
    });
    await markInboundEvent(txDb, { provider: 'nomba', requestId: input.requestId, status: 'ignored' });
    return { handled: true, firstSeen, outcome: 'ignored' };
  }

  const ctx: DomainContext = scope;
  const result = await settleInboundEvent(txDb, ctx, {
    eventType: input.eventType,
    payload: input.payload,
  });

  const { firstSeen } = await recordInboundEvent(txDb, {
    environment: scope.environment,
    provider: 'nomba',
    requestId: input.requestId,
    eventType: input.eventType,
    payload: input.payload,
    organizationId: scope.organizationId,
  });

  await markInboundEvent(txDb, {
    provider: 'nomba',
    requestId: input.requestId,
    status: result.outcome === 'ignored' ? 'ignored' : 'processed',
  });

  return { handled: true, firstSeen, outcome: result.outcome };
}
