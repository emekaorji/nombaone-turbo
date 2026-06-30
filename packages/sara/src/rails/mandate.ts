import { mapGatewayMessage } from '../nomba/failure-taxonomy';
import { NOMBA_ENDPOINTS } from '../nomba/endpoints';

import type { NombaClient } from '../nomba/client';
import type { RailAdapter, RailCollectInput, RailCollectResult } from './types';

/**
 * Mandate rail (pull) — debits an `ACTIVE`+`ADVICE_SENT` direct-debit mandate.
 * Unlike the card rail the debit is **synchronous/inline** (integration-ref §5 —
 * no mandate webhook in the public docs; T0 confirms whether the team surface
 * fires one), so the response carries the outcome. `maxAmount` is a hard per-debit
 * ceiling — an over-ceiling bill fails here (06 triggers new-mandate + re-consent;
 * we NEVER split a debit to sneak under the cap).
 */
export function createMandateRail(client: NombaClient): RailAdapter {
  return {
    key: 'mandate',
    direction: 'pull',
    async collect(input: RailCollectInput): Promise<RailCollectResult> {
      const meta = input.metadata ?? {};
      const mandateId = meta.mandateId as string | undefined;
      const maxAmount = typeof meta.maxAmount === 'number' ? meta.maxAmount : undefined;
      if (!mandateId) {
        return { status: 'failed', failureReason: 'no_mandate_on_method' };
      }
      if (maxAmount !== undefined && input.amountKobo > maxAmount) {
        return { status: 'failed', failureReason: 'mandate_max_amount_exceeded' };
      }

      const res = await client.request<Record<string, unknown>>({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.mandateDebit,
        idempotencyRef: input.reference,
        body: { mandateId, amount: input.amountKobo }, // kobo
      });

      if (!res.ok) {
        return { status: 'failed', providerReference: input.reference, failureReason: 'request_failed' };
      }

      const data = (res.data ?? {}) as Record<string, unknown>;
      const inner = (data.data ?? data) as Record<string, unknown>;
      const ok =
        inner.status === 'SUCCESS' || data.code === '00' || data.status === true;
      if (ok) {
        return { status: 'succeeded', providerReference: input.reference };
      }
      const message = typeof inner.message === 'string' ? inner.message : undefined;
      return {
        status: 'failed',
        providerReference: input.reference,
        failureReason: mapGatewayMessage(message),
      };
    },
  };
}
