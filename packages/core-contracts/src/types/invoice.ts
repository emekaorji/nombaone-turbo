import type { Environment } from './common';

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
  amount: number; // signed kobo
  quantity: number;
}

/**
 * INVOICE DTO. `status` is DERIVED (never a stored money column). Money fields are
 * integer kobo; line `amount`s are signed.
 */
export interface InvoiceResponseData {
  id: string; // public reference, e.g. `nbo…inv`
  customerId: string;
  subscriptionId: string | null;
  status: InvoiceStatus;
  billingReason: InvoiceBillingReason;
  subtotal: number;
  discountTotal: number;
  creditTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: 'NGN';
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  lineItems: InvoiceLineItemData[];
  finalizedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  environment: Environment;
  createdAt: string;
}
