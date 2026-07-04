import type { InvoiceResponseData } from './invoice';

/**
 * ── Test-mode instrument responses ──────────────────────────────────────────
 * Returned only by the `/v1/sandbox/*` endpoints on a test deployment. Test payment
 * methods reuse `PaymentMethodResponseData` (a real, chargeable method row).
 */

/** Result of forcing one billing cycle via POST /v1/sandbox/subscriptions/{id}/advance-cycle. */
export interface AdvanceCycleResponseData {
  domain: 'advance_cycle_result'; // response object-type discriminator
  subscriptionId: string;
  /** The billing outcome of the cycle: paid | past_due | pending | open. */
  outcome: string;
  /** The invoice the cycle produced (or the existing one if the period was already billed). */
  invoice: InvoiceResponseData;
}

/** Result of POST /v1/sandbox/webhooks/simulate — the minted event + how many deliveries fired. */
export interface WebhookSimulationResponseData {
  domain: 'webhook_simulation'; // response object-type discriminator
  /** The emitted domain event's reference (`nbo…EVT`). */
  event: string;
  /** The catalog event type that was emitted. */
  type: string;
  /** How many webhook deliveries were attempted for this event on this call. */
  deliveredCount: number;
}
