import type { Mode } from './common';

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'partially_paid'
  | 'paid'
  | 'void'
  | 'uncollectible';
export type InvoiceBillingReason =
  | 'subscription_create'
  | 'subscription_cycle'
  | 'subscription_update'
  | 'manual';
export type InvoiceLineKind = 'subscription' | 'proration' | 'discount' | 'credit' | 'adjustment';

export interface InvoiceLineItemData {
  id: string; // line reference
  kind: InvoiceLineKind;
  description: string;
  amountInKobo: number; // signed kobo
  quantity: number;
}

/**
 * INVOICE DTO. `status` is DERIVED (never a stored money column). Money fields are
 * integer kobo; line `amount`s are signed.
 */
export interface InvoiceResponseData {
  domain: 'invoice'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo…inv`
  customerId: string;
  subscriptionId: string | null;
  status: InvoiceStatus;
  billingReason: InvoiceBillingReason;
  subtotalInKobo: number;
  discountTotalInKobo: number;
  creditTotalInKobo: number;
  totalInKobo: number;
  amountDueInKobo: number;
  amountPaidInKobo: number;
  amountRemainingInKobo: number;
  currency: 'NGN';
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  lineItems: InvoiceLineItemData[];
  finalizedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  mode: Mode;
  createdAt: string;
}
