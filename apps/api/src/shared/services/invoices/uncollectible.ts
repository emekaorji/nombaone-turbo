import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * Mark an open invoice uncollectible — the 06 dunning-exhausted hook (the derived
 * status becomes `uncollectible`). No event here: the `subscription.churned` event
 * is emitted at the subscription level by `churnFromPastDue`. Idempotent; a paid or
 * void invoice is left untouched.
 */
export async function markInvoiceUncollectible(
  txDb: InfraTxDb,
  _ctx: DomainContext,
  invoice: InvoiceRow
): Promise<InvoiceRow> {
  if (invoice.uncollectibleAt || invoice.paidAt || invoice.voidedAt) return invoice;
  const [updated] = await txDb
    .update(invoicesTable)
    .set({ uncollectibleAt: new Date() })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  return updated ?? invoice;
}
