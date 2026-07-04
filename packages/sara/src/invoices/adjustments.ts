import { eq } from 'drizzle-orm';

import {
  customersTable,
  invoiceLineItemsTable,
  invoicesTable,
  type InvoiceRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { applyCreditsOldestFirst } from '../credits';
import { resolveAndConsumeDiscount } from '../discounts';
import { emitEvent } from '../events';
import { mintReference } from '../reference';
import { claimInvoicePaid } from './markPaid';
import { getInvoiceLineRows, loadInvoiceRow } from './queries';

import type { InvoiceLineKind } from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '../context';

export interface AppendLine {
  kind: InvoiceLineKind;
  description: string;
  amount: number;
  sourceReference?: string;
  quantity?: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

/** PURE J4: Σ(signed line items) MUST equal `amount_due`. */
export function assertInvoiceBalanced(lines: ReadonlyArray<{ amount: number }>, amountDue: number): void {
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== amountDue) {
    throw AppError.UnprocessableEntity(
      'invoice line items do not sum to amount_due',
      { sum, amountDue },
      NOMBAONE_ERROR_CODES.INVOICE_NOT_BALANCED
    );
  }
}

/** Append signed line items (discount / credit / proration / adjustment) to an invoice. */
export async function appendInvoiceLines(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string,
  lines: AppendLine[]
): Promise<void> {
  if (lines.length === 0) return;
  await txDb.insert(invoiceLineItemsTable).values(
    lines.map((l) => ({
      reference: mintReference('ILI'),
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      invoiceId,
      kind: l.kind,
      description: l.description,
      amount: l.amount,
      quantity: l.quantity ?? 1,
      periodStart: l.periodStart ?? null,
      periodEnd: l.periodEnd ?? null,
      sourceReference: l.sourceReference ?? null,
    }))
  );
}

export interface FinalizeWithAdjustmentsResult {
  invoice: InvoiceRow;
  amountDue: number;
  paid: boolean;
}

/**
 * Finalize an invoice resolving the FIXED order (so totals are deterministic):
 *   subtotal      = Σ subscription + proration lines
 *   discountTotal = active discount on the subtotal (clamped, consumes a cycle)
 *   afterDiscount = subtotal − discountTotal
 *   creditTotal   = credits applied oldest-first on afterDiscount (C8)
 *   amount_due    = afterDiscount − creditTotal  (≥ 0)
 * Adds the explicit discount + credit line items, asserts Σ lines === amount_due
 * (J4), and routes the **J8 zero path** (amount_due 0 → paid, NO rail). Immutable
 * (J2): an already-finalized invoice → INVOICE_ALREADY_FINALIZED.
 */
export async function finalizeInvoiceWithAdjustments(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceReference: string
): Promise<FinalizeWithAdjustmentsResult> {
  const invoice = await loadInvoiceRow(txDb, ctx, invoiceReference);
  if (invoice.finalizedAt) {
    throw AppError.Conflict(
      'invoice is already finalized',
      { reference: invoiceReference },
      NOMBAONE_ERROR_CODES.INVOICE_ALREADY_FINALIZED
    );
  }

  const [customer] = await txDb
    .select({ reference: customersTable.reference })
    .from(customersTable)
    .where(eq(customersTable.id, invoice.customerId))
    .limit(1);
  const customerRef = customer?.reference ?? '';

  const existing = await getInvoiceLineRows(txDb, ctx, invoice.id);
  const subtotal = existing.reduce((s, l) => s + l.amount, 0);

  const discountLine = await resolveAndConsumeDiscount(txDb, ctx, {
    subscriptionId: invoice.subscriptionId,
    customerId: invoice.customerId,
    subtotal,
  });
  const discountTotal = discountLine ? -discountLine.amount : 0; // positive magnitude
  if (discountLine) await appendInvoiceLines(txDb, ctx, invoice.id, [discountLine]);

  const afterDiscount = subtotal - discountTotal;

  const { lines: creditLines, totalApplied: creditTotal } = await applyCreditsOldestFirst(txDb, ctx, {
    customerId: invoice.customerId,
    customerRef,
    amountDue: afterDiscount,
  });
  if (creditLines.length > 0) await appendInvoiceLines(txDb, ctx, invoice.id, creditLines);

  const total = subtotal - discountTotal;
  const amountDue = total - creditTotal;

  const allLines = await getInvoiceLineRows(txDb, ctx, invoice.id);
  assertInvoiceBalanced(allLines, amountDue);

  const [finalized] = await txDb
    .update(invoicesTable)
    .set({ subtotal, discountTotal, creditTotal, total, amountDue, finalizedAt: new Date() })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  if (!finalized) {
    throw AppError.InternalServerError(
      'failed to finalize invoice',
      { reference: invoiceReference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }
  await emitEvent(txDb, { ...ctx, type: 'invoice.finalized', payload: { reference: invoiceReference } });

  if (amountDue === 0) {
    // J8: fully covered by discount/credit → paid with NO rail charge. The credit
    // application already posted its revenue-recognition ledger entry; a
    // discount-only zero invoice moved no money (it is simply free).
    const claim = await claimInvoicePaid(txDb, ctx, finalized);
    return { invoice: claim.invoice, amountDue: 0, paid: claim.claimed };
  }
  return { invoice: finalized, amountDue, paid: false };
}
