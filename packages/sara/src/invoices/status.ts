import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { InvoiceStatus } from './types';

/**
 * Derive an invoice's status (A12/J3) from its timestamp signals — there is NO
 * stored money-status column to drift. `paid_at` is set atomically with the
 * settlement ledger post, so the derived `paid` is always consistent with the
 * ledger. Precedence: void → uncollectible → paid → draft/open. A finalized
 * zero-amount invoice is `paid` (J8 — never a ₦0 charge).
 */
export function deriveInvoiceStatus(
  invoice: Pick<
    InvoiceRow,
    'finalizedAt' | 'voidedAt' | 'paidAt' | 'uncollectibleAt' | 'amountDue' | 'amountPaid'
  >
): InvoiceStatus {
  if (invoice.voidedAt) return 'void';
  if (invoice.uncollectibleAt) return 'uncollectible';
  if (invoice.paidAt) return 'paid';
  if (!invoice.finalizedAt) return 'draft';
  if (invoice.amountDue === 0) return 'paid';
  // 05: a short collection (partial collection enabled) left some paid + a
  // remainder owing — finalized, not fully paid, some amount collected.
  if (invoice.amountPaid > 0) return 'partially_paid';
  return 'open';
}
