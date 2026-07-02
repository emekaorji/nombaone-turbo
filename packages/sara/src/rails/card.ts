import { NOMBA_ENDPOINTS } from '../nomba/endpoints';
import { koboToNombaAmount } from '../nomba/money';

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
 *  • E9: currency is always NGN; the amount is converted from our integer kobo to the
 *    naira decimal string Nomba expects (`koboToNombaAmount` — D.1, else 100× overcharge).
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
      const res = await client.request<{ data?: { status?: boolean; message?: string } }>({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.tokenizedCardCharge,
        idempotencyRef: orderReference,
        body: {
          tokenKey,
          order: {
            amount: koboToNombaAmount(input.amountKobo), // kobo → naira decimal string (D.1)
            currency: 'NGN',
            customerId: meta.customerId,
            customerEmail: meta.customerEmail,
            callbackUrl: meta.callbackUrl,
            orderReference,
            // Scope the charge to the tenant's Nomba sub-account — funds land there AND the
            // payment_success webhook fires (live-confirmed: parent-pool charges never webhook).
            ...(meta.accountId ? { accountId: meta.accountId } : {}),
          },
        },
      });

      // The domain outcome lives in `data.status` + `data.message` (res.ok is only
      // HTTP-200). Live-proven shapes of `data.message`:
      //   • "Approved by Financial Institution"      → silent success (webhook settles)
      //   • "Kindly enter the OTP sent to ****1958"  → bank OTP/3DS step-up required
      //   • "Tokenized charge failed"                → decline
      const inner = res.data?.data;
      if (!res.ok || inner == null) {
        return { status: 'failed', providerReference: orderReference, failureReason: 'request_failed' };
      }
      // (C) Definitive decline — data.status:false.
      if (inner.status !== true) {
        return {
          status: 'failed',
          providerReference: orderReference,
          failureReason: inner.message ?? 'tokenized_charge_failed',
        };
      }
      // (B) Accepted but the bank forces customer authentication (OTP/3DS).
      const msg = String(inner.message ?? '').toLowerCase();
      if (msg.includes('otp') || msg.includes('3ds') || msg.includes('secure')) {
        return {
          status: 'requires_action',
          providerReference: orderReference,
          failureReason: 'otp_required',
          action: { type: 'otp_3ds', message: String(inner.message ?? 'otp_required') },
        };
      }
      // (A) Approved / unknown-but-accepted — optimistic pending; confirm via webhook
      // + requery (E4), never trust the sync reply as a settled `succeeded`.
      return { status: 'pending', providerReference: orderReference };
    },
  };
}
