import { mapNombaEvent } from '@nombaone/sara/nomba/events';
import { captureCardToken } from './capture';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { TokenizedCardData } from './types';

/**
 * Route a verified, de-duplicated inbound Nomba event to its settle handler. In
 * Phase 02 the only money-state settle is **card token capture** (persist the
 * `tokenKey` from a `payment_success` carrying `tokenizedCardData`). Everything
 * else — a charge success (no card data), a `payment_failed`, a virtual-account
 * funding — is `recorded`: the ledger credit + the dunning taxonomy are 03/06's
 * concern. An unmapped type is `ignored` (F5). Idempotent: `captureCardToken` is a
 * no-op on an already-active method (F2/F4).
 */
export interface SettleResult {
  outcome: 'captured' | 'recorded' | 'ignored';
}

export async function settleInboundEvent(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { eventType: string; payload: Record<string, unknown> }
): Promise<SettleResult> {
  const mapped = mapNombaEvent(input.eventType, input.payload);
  if (mapped.type === 'ignored') return { outcome: 'ignored' };

  const data = (input.payload.data ?? input.payload) as Record<string, unknown>;

  if (mapped.type === 'payment_succeeded' && !mapped.isVirtualAccountFunding) {
    const tcd = data.tokenizedCardData as TokenizedCardData | undefined;
    const order = (data.order ?? data) as Record<string, unknown>;
    const orderRef = String(data.orderReference ?? order.orderReference ?? data.merchantTxRef ?? '');
    if (tcd?.tokenKey && orderRef) {
      await captureCardToken(txDb, ctx, { reference: orderRef, tokenizedCardData: tcd });
      return { outcome: 'captured' };
    }
  }

  return { outcome: 'recorded' };
}
