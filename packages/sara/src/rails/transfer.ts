import { toNombaAccountName } from '../nomba/accountName';
import { NOMBA_ENDPOINTS } from '../nomba/endpoints';
import { koboToNombaAmount } from '../nomba/money';

import type { NombaClientFactory } from '../nomba/injected';
import type { RailAdapter, RailCollectInput, RailCollectResult } from './types';

/**
 * Transfer rail (push) — issues/resolves a dedicated virtual NUBAN and returns
 * `pending` + `payInstructions` (the payer must push; we cannot pull). Settlement
 * arrives later as an inbound `payment_success` with `type:"vact_transfer"`,
 * reconciled by `aliasAccountReference` → our reference (handled by the inbound
 * pipeline). The `expectedAmount` is a hint; over/under-payment is handled where
 * the money lands.
 */
export function createTransferRail(getClient: NombaClientFactory): RailAdapter {
  return {
    key: 'transfer',
    direction: 'push',
    async collect(input: RailCollectInput): Promise<RailCollectResult> {
      const meta = input.metadata;
      const accountRef = meta?.accountRef ?? input.reference;

      const client = getClient(input.mode);
      const res = await client.request<Record<string, unknown>>({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.virtualAccountCreate,
        idempotencyRef: accountRef,
        body: {
          accountRef,
          // Letters and spaces only, or Nomba refuses the account — and it refuses
          // it as an HTTP 200 (see toNombaAccountName). The old fallback here
          // interpolated `accountRef`, whose digits alone would have been rejected.
          accountName: toNombaAccountName(meta?.accountName),
          expectedAmount: koboToNombaAmount(input.amountKobo), // kobo → naira decimal string (D.1)
        },
      });

      if (!res.ok) {
        return { status: 'failed', providerReference: accountRef, failureReason: 'request_failed' };
      }

      // Nomba wraps every body as `{ code, description, data: {...} }` — the bank
      // fields live one level DOWN. Probe-confirmed on the fresh account
      // (2026-07-12): `data.data.{bankAccountNumber,bankAccountName,bankName}`.
      // This used to read the OUTER envelope, so production payInstructions were
      // all `undefined` — a NUBAN of `undefined` handed to a payer.
      const data = (res.data ?? {}) as Record<string, unknown>;
      const inner = ((data.data ?? data) ?? {}) as Record<string, unknown>;
      return {
        status: 'pending',
        providerReference: accountRef,
        payInstructions: {
          bankName: typeof inner.bankName === 'string' ? inner.bankName : undefined,
          accountNumber:
            typeof inner.bankAccountNumber === 'string' ? inner.bankAccountNumber : undefined,
          accountName:
            typeof inner.bankAccountName === 'string' ? inner.bankAccountName : undefined,
          amountKobo: input.amountKobo,
          reference: accountRef,
        },
      };
    },
  };
}
