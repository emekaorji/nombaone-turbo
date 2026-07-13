import type {
  InvoiceBillingReason,
  InvoiceLineItemData,
  InvoiceLineKind,
  InvoicePayInstructionsData,
  InvoiceResponseData,
  InvoiceStatus,
} from '@nombaone/core-contracts/types';

export type {
  InvoiceBillingReason,
  InvoiceLineItemData,
  InvoiceLineKind,
  InvoicePayInstructionsData,
  InvoiceResponseData,
  InvoiceStatus,
};

/** One line to write onto an invoice. `amount` is signed kobo (discount/credit < 0). */
export interface InvoiceLineInput {
  kind: InvoiceLineKind;
  description: string;
  amount: number;
  quantity?: number;
  subscriptionItemId?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

export interface CreateInvoiceInput {
  customerId: string; // internal UUID — supplied by the billing flow
  subscriptionId?: string;
  periodIndex?: number;
  billingReason: InvoiceBillingReason;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  dueDate?: Date | null;
  lines: InvoiceLineInput[];
}

export interface ListInvoicesOptions {
  customerRef?: string;
  subscriptionRef?: string;
  status?: InvoiceStatus;
  limit?: number;
  cursor?: string;
}
