import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { InvoiceLineInput } from './types';

/**
 * PURE invariant (J4/⚠): the signed line amounts MUST sum to the invoice total, to
 * the kobo. Called before every finalize; an unbalanced invoice can never be
 * finalized (mirrors the ledger's `assertBalanced`).
 */
export function assertLineItemsSumToTotal(lines: ReadonlyArray<{ amount: number }>, total: number): void {
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== total) {
    throw AppError.UnprocessableEntity(
      'invoice line items do not sum to the total',
      { sum, total },
      NOMBAONE_ERROR_CODES.INVOICE_LINE_ITEMS_UNBALANCED
    );
  }
}

/** Build the one `subscription` line for a cycle invoice (amount = unit × quantity). */
export function buildSubscriptionLine(input: {
  description: string;
  unitAmount: number;
  quantity: number;
  subscriptionItemId?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}): InvoiceLineInput {
  return {
    kind: 'subscription',
    description: input.description,
    amount: input.unitAmount * input.quantity,
    quantity: input.quantity,
    subscriptionItemId: input.subscriptionItemId,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
  };
}
