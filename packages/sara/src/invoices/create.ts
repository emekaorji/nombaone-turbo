import { and, eq } from 'drizzle-orm';

import { invoiceLineItemsTable, invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { mintReference } from '../reference';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreateInvoiceInput } from './types';

/**
 * Create a DRAFT invoice + its line items. **Idempotent on `(subscription_id,
 * period_index)` (K2):** if a cycle invoice already exists for the period, return
 * it (no second row) — the `unique(subscription_id, period_index)` index is the
 * structural backstop against a race. `subtotal`/`total`/`amount_due` are the
 * signed line sum (only `subscription` lines this phase). Emits `invoice.created`.
 */
export async function createInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateInvoiceInput
): Promise<InvoiceRow> {
  if (input.subscriptionId != null && input.periodIndex != null) {
    const [existing] = await txDb
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.organizationId, ctx.organizationId),
          eq(invoicesTable.environment, ctx.environment),
          eq(invoicesTable.subscriptionId, input.subscriptionId),
          eq(invoicesTable.periodIndex, input.periodIndex)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  const subtotal = input.lines.reduce((s, l) => s + l.amount, 0);
  const total = subtotal;
  const reference = mintReference('INV');

  let row: InvoiceRow | undefined;
  try {
    const inserted = await txDb
      .insert(invoicesTable)
      .values({
        reference,
        organizationId: ctx.organizationId,
        environment: ctx.environment,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId ?? null,
        periodIndex: input.periodIndex ?? null,
        billingReason: input.billingReason,
        subtotal,
        total,
        amountDue: total,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        dueDate: input.dueDate ?? null,
      })
      .returning();
    row = inserted[0];
  } catch (err) {
    // Lost a concurrent (subscription_id, period_index) race — the pre-check missed
    // but the partial unique index blocked this second row. Honor the idempotent
    // contract (K2): return the invoice the winning racer created, never a 500.
    if (input.subscriptionId != null && input.periodIndex != null) {
      const [existing] = await txDb
        .select()
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.organizationId, ctx.organizationId),
            eq(invoicesTable.environment, ctx.environment),
            eq(invoicesTable.subscriptionId, input.subscriptionId),
            eq(invoicesTable.periodIndex, input.periodIndex)
          )
        )
        .limit(1);
      if (existing) return existing;
    }
    throw err;
  }
  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist invoice',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  if (input.lines.length > 0) {
    await txDb.insert(invoiceLineItemsTable).values(
      input.lines.map((l) => ({
        reference: mintReference('ILI'),
        organizationId: ctx.organizationId,
        environment: ctx.environment,
        invoiceId: row.id,
        subscriptionItemId: l.subscriptionItemId ?? null,
        kind: l.kind,
        description: l.description,
        amount: l.amount,
        quantity: l.quantity ?? 1,
        periodStart: l.periodStart ?? null,
        periodEnd: l.periodEnd ?? null,
      }))
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.created',
    payload: { reference, subscriptionId: input.subscriptionId, periodIndex: input.periodIndex },
  });

  return row;
}
