import { deriveInvoiceStatus } from './status';

import type { InvoiceLineItemRow, InvoiceRow } from '@nombaone/core-db/schema';
import type { InvoiceLineItemData, InvoiceResponseData } from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export const serializeInvoiceLine = (row: InvoiceLineItemRow): InvoiceLineItemData => ({
  id: row.reference,
  kind: row.kind,
  description: row.description,
  amountInKobo: row.amount,
  quantity: row.quantity,
});

export const serializeInvoice = (
  row: InvoiceRow,
  customerRef: string,
  subscriptionRef: string | null,
  lines: InvoiceLineItemData[]
): InvoiceResponseData => ({
  domain: 'invoice',
  id: row.reference,
  customerId: customerRef,
  subscriptionId: subscriptionRef,
  status: deriveInvoiceStatus(row),
  billingReason: row.billingReason,
  subtotalInKobo: row.subtotal,
  discountTotalInKobo: row.discountTotal,
  creditTotalInKobo: row.creditTotal,
  totalInKobo: row.total,
  amountDueInKobo: row.amountDue,
  amountPaidInKobo: row.amountPaid,
  amountRemainingInKobo: row.amountRemaining,
  currency: 'NGN',
  periodStart: iso(row.periodStart),
  periodEnd: iso(row.periodEnd),
  dueDate: iso(row.dueDate),
  lineItems: lines,
  finalizedAt: iso(row.finalizedAt),
  paidAt: iso(row.paidAt),
  voidedAt: iso(row.voidedAt),
  mode: row.mode,
  createdAt: new Date(row.createdAt).toISOString(),
});
