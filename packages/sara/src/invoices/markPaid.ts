import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * Mark an invoice paid. Idempotent (J6): already-`paid` returns unchanged — no
 * second settlement. Sets `paid_at` (the derived-`paid` signal) atomically with
 * `amount_paid` and the linked settlement ledger transaction. Emits `invoice.paid`.
 */
export async function markInvoicePaid(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  ledgerTransactionId: string | null
): Promise<InvoiceRow> {
  if (invoice.paidAt) return invoice;

  const [updated] = await txDb
    .update(invoicesTable)
    .set({
      paidAt: new Date(),
      amountPaid: invoice.total,
      ledgerTransactionId: ledgerTransactionId ?? invoice.ledgerTransactionId,
    })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  if (!updated) {
    throw AppError.InternalServerError(
      'failed to mark invoice paid',
      { reference: invoice.reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'invoice.paid', payload: { reference: invoice.reference } });
  return updated;
}
