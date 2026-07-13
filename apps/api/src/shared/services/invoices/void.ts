import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';

import { loadInvoiceRow } from './queries';
import { deriveInvoiceStatus } from './status';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * Void an invoice — legal only from `draft`/`open` (J9). A `paid` invoice is
 * corrected by a ledger **reversal** (`ledger/reverse`), never a void, so the
 * money record stays append-only (J2). Idempotent on an already-void invoice.
 * Emits `invoice.voided`.
 */
export async function voidInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  comment?: string
): Promise<InvoiceRow> {
  const invoice = await loadInvoiceRow(txDb, ctx, reference);
  const status = deriveInvoiceStatus(invoice);
  if (status === 'void') return invoice;
  if (status !== 'draft' && status !== 'open') {
    throw AppError.UnprocessableEntity(
      'only a draft or open invoice can be voided; a paid invoice is corrected by a reversal',
      { reference, status },
      NOMBAONE_ERROR_CODES.INVOICE_NOT_VOIDABLE
    );
  }

  const metadata = comment ? { ...invoice.metadata, voidComment: comment } : invoice.metadata;
  const [updated] = await txDb
    .update(invoicesTable)
    .set({ voidedAt: new Date(), metadata })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  if (!updated) {
    throw AppError.InternalServerError(
      'failed to void invoice',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'invoice.voided', payload: { reference } });
  return updated;
}
