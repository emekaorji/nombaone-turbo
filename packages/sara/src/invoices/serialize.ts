import { deriveInvoiceStatus } from './status';

import type { InvoiceLineItemRow, InvoiceRow } from '@nombaone/core-db/schema';
import type { InvoiceLineItemData, InvoiceResponseData } from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export const serializeInvoiceLine = (row: InvoiceLineItemRow): InvoiceLineItemData => ({
  id: row.reference,
  kind: row.kind,
  description: row.description,
  amount: row.amount,
  quantity: row.quantity,
});

export const serializeInvoice = (
  row: InvoiceRow,
  customerRef: string,
  subscriptionRef: string | null,
  lines: InvoiceLineItemData[]
): InvoiceResponseData => ({
  id: row.reference,
  customerId: customerRef,
  subscriptionId: subscriptionRef,
  status: deriveInvoiceStatus(row),
  billingReason: row.billingReason,
  subtotal: row.subtotal,
  discountTotal: row.discountTotal,
  creditTotal: row.creditTotal,
  total: row.total,
  amountDue: row.amountDue,
  amountPaid: row.amountPaid,
  amountRemaining: row.amountRemaining,
  currency: 'NGN',
  periodStart: iso(row.periodStart),
  periodEnd: iso(row.periodEnd),
  dueDate: iso(row.dueDate),
  lineItems: lines,
  finalizedAt: iso(row.finalizedAt),
  paidAt: iso(row.paidAt),
  voidedAt: iso(row.voidedAt),
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
