import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';

import { assertLineItemsSumToTotal } from './lineItems';
import { claimInvoicePaid } from './markPaid';
import { getInvoiceLineRows, loadInvoiceRow } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * Finalize an invoice → from here it is **immutable** (J2: `total`/`amount_due`
 * are never rewritten). Asserts the line-item-sum invariant first (J4). If
 * `amount_due === 0`, short-circuits to `paid` with **no rail/charge** (J8 — never
 * a ₦0 charge). Idempotent: an already-finalized invoice is returned unchanged.
 * Emits `invoice.finalized`.
 */
export async function finalizeInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<InvoiceRow> {
  const invoice = await loadInvoiceRow(txDb, ctx, reference);
  if (invoice.finalizedAt) return invoice;

  const lines = await getInvoiceLineRows(txDb, ctx, invoice.id);
  assertLineItemsSumToTotal(lines, invoice.total);

  const [finalized] = await txDb
    .update(invoicesTable)
    .set({ finalizedAt: new Date() })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  if (!finalized) {
    throw AppError.InternalServerError(
      'failed to finalize invoice',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'invoice.finalized', payload: { reference } });

  if (finalized.amountDue === 0) {
    // J8 zero-amount → paid with no rail/charge. The caller (runCycle) sees paid_at
    // and applies the subscription effects; there is no settlement race for a ₦0
    // invoice (no rail, no webhook), so a plain claim suffices.
    const claim = await claimInvoicePaid(txDb, ctx, finalized);
    return claim.invoice;
  }
  return finalized;
}
