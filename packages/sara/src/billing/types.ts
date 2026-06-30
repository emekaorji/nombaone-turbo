import type { InvoiceRow } from '@nombaone/core-db/schema';

/** The outcome of attempting to collect for a finalized invoice. */
export type CollectOutcome = 'paid' | 'past_due' | 'pending';

export interface CollectResult {
  outcome: CollectOutcome;
  invoice: InvoiceRow;
}

/**
 * The provider-confirmed result of a **requery** (NOT the raw webhook). The inbound
 * worker requeries Nomba with the provider reference and passes this; the confirm
 * path settles only when it matches our `amount_due` (E4 — never trust the webhook).
 */
export interface InboundVerification {
  settledAmountKobo: number;
  status: 'settled' | 'pending' | 'failed';
  providerReference?: string;
}
