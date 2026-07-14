import { deriveInvoiceStatus } from './status';

import type { InvoiceLineItemRow, InvoiceRow } from '@nombaone/core-db/schema';
import type {
  InvoiceLineItemData,
  InvoicePayInstructionsData,
  InvoiceResponseData,
} from './types';

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

/**
 * The pay instructions ride in `invoices.metadata.payInstructions` (persisted by
 * the push-rail collect) — validate the shape out of the jsonb rather than
 * trusting it, so a hand-edited row can't leak garbage onto the wire.
 */
const payInstructionsOf = (row: InvoiceRow): InvoicePayInstructionsData | null => {
  const raw = (row.metadata as Record<string, unknown> | null)?.payInstructions;
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  return {
    bankName: typeof p.bankName === 'string' ? p.bankName : null,
    accountNumber: typeof p.accountNumber === 'string' ? p.accountNumber : null,
    accountName: typeof p.accountName === 'string' ? p.accountName : null,
    amountInKobo: typeof p.amountKobo === 'number' ? p.amountKobo : row.amountDue,
    reference: typeof p.reference === 'string' ? p.reference : null,
  };
};

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
  payInstructions: payInstructionsOf(row),
  lineItems: lines,
  finalizedAt: iso(row.finalizedAt),
  paidAt: iso(row.paidAt),
  voidedAt: iso(row.voidedAt),
  mode: row.mode,
  createdAt: new Date(row.createdAt).toISOString(),
});
