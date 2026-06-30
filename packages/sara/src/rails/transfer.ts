import { NOMBA_ENDPOINTS } from '../nomba/endpoints';

import type { NombaClient } from '../nomba/client';
import type { RailAdapter, RailCollectInput, RailCollectResult } from './types';

/**
 * Transfer rail (push) — issues/resolves a dedicated virtual NUBAN and returns
 * `pending` + `payInstructions` (the payer must push; we cannot pull). Settlement
 * arrives later as an inbound `payment_success` with `type:"vact_transfer"`,
 * reconciled by `aliasAccountReference` → our reference (handled by the inbound
 * pipeline). The `expectedAmount` is a hint; over/under-payment is handled where
 * the money lands.
 */
export function createTransferRail(client: NombaClient): RailAdapter {
  return {
    key: 'transfer',
    direction: 'push',
    async collect(input: RailCollectInput): Promise<RailCollectResult> {
      const meta = input.metadata ?? {};
      const accountRef = (meta.accountRef as string | undefined) ?? input.reference;

      const res = await client.request<Record<string, unknown>>({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.virtualAccountCreate,
        idempotencyRef: accountRef,
        body: {
          accountRef,
          accountName: (meta.accountName as string | undefined) ?? `nombaone ${accountRef}`,
          expectedAmount: input.amountKobo, // kobo hint
        },
      });

      if (!res.ok) {
        return { status: 'failed', providerReference: accountRef, failureReason: 'request_failed' };
      }

      const data = (res.data ?? {}) as Record<string, unknown>;
      return {
        status: 'pending',
        providerReference: accountRef,
        payInstructions: {
          bankName: data.bankName,
          accountNumber: data.bankAccountNumber,
          accountName: data.bankAccountName,
          amountKobo: input.amountKobo,
          reference: accountRef,
        },
      };
    },
  };
}
