import type { Mode } from './common';
import type { InvoiceBillingReason, InvoiceLineItemData } from './invoice';

/**
 * A PREVIEW of the next invoice a subscription will generate — computed from the
 * pure period math + the current effective price (or a scheduled phase's price if
 * one applies next). Persists nothing.
 */
export interface UpcomingInvoiceResponseData {
  domain: 'upcoming_invoice'; // response object-type discriminator
  subscriptionId: string;
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  billingReason: InvoiceBillingReason;
  subtotalInKobo: number;
  totalInKobo: number;
  amountDueInKobo: number;
  currency: 'NGN';
  lineItems: InvoiceLineItemData[];
  mode: Mode;
}
