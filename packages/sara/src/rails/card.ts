import { NOMBA_ENDPOINTS } from '../nomba/endpoints';

import type { NombaClient } from '../nomba/client';
import type { RailAdapter, RailCollectInput, RailCollectResult } from './types';

/**
 * Card rail (pull) — charges a stored `tokenKey` via the tokenized-card endpoint.
 *
 *  • E3: the `orderReference`/`merchantTxRef` is OUR `input.reference` — stable, so
 *    a retry reuses it and Nomba dedupes (no second charge).
 *  • E4: the sync reply only signals ACCEPTANCE. The definitive succeeded/failed
 *    outcome comes from the `payment_success`/`payment_failed` webhook (settled by
 *    the inbound pipeline) and/or a `requeryTransaction` — so `collect` returns
 *    `pending` on acceptance, never a trusted `succeeded`.
 *  • E9: currency is always NGN; the amount is integer kobo straight through.
 *
 * The token + customer fields ride in `input.metadata` (the billing core passes
 * the resolved payment method through, staying rail-agnostic).
 */
export function createCardRail(client: NombaClient): RailAdapter {
  return {
    key: 'card',
    direction: 'pull',
    async collect(input: RailCollectInput): Promise<RailCollectResult> {
      const meta = input.metadata ?? {};
      const tokenKey = meta.tokenKey as string | undefined;
      if (!tokenKey) {
        return { status: 'failed', failureReason: 'no_token_on_method' };
      }

      const orderReference = input.reference; // E3
      const res = await client.request({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.tokenizedCardCharge,
        idempotencyRef: orderReference,
        body: {
          tokenKey,
          order: {
            amount: input.amountKobo, // kobo, no conversion (D.1)
            currency: 'NGN',
            customerId: meta.customerId,
            customerEmail: meta.customerEmail,
            callbackUrl: meta.callbackUrl,
            orderReference,
          },
        },
      });

      if (!res.ok) {
        return { status: 'failed', providerReference: orderReference, failureReason: 'request_failed' };
      }
      // Accepted — confirm via webhook + requery (E4), do not trust the sync reply.
      return { status: 'pending', providerReference: orderReference };
    },
  };
}
