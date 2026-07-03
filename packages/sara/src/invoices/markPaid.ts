import { and, eq, isNull } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';

import { emitEvent } from '../events';

import type { DomainContext, InfraTxDb } from '../context';

export interface InvoicePaidClaim {
  /**
   * `true` ⇒ THIS caller won the atomic claim and must post the settlement ledger
   * entry (then back-link it). `false` ⇒ a concurrent flow already settled the
   * invoice, or it is void/uncollectible — the caller must post **nothing** (J6).
   */
  claimed: boolean;
  invoice: InvoiceRow;
}

/**
 * Atomically CLAIM an invoice as paid — a compare-and-swap. The DB predicate
 * `paid_at IS NULL AND voided_at IS NULL AND uncollectible_at IS NULL` is the REAL
 * no-double-settle guard: a single conditional UPDATE is atomic, so a concurrent
 * collect+confirm, a redelivered webhook, or a runCycle/webhook overlap resolve to
 * exactly ONE winner — no row lock or enclosing transaction required (J6/K2). A
 * stale in-memory snapshot can never double-claim. Sets `paid_at` + `amount_paid`
 * and emits `invoice.paid` ONLY on a winning claim; the winner then posts the
 * ledger entry and back-links it via `linkInvoiceLedgerTransaction`. A lost claim
 * is a no-op that returns the current (already-settled / terminal) row.
 *
 * (A crash between a winning claim and the ledger post leaves a paid invoice with a
 * null `ledger_transaction_id` — a state the 09 reconciliation detects and repairs;
 * strictly better than a double charge.)
 */
export async function claimInvoicePaid(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<InvoicePaidClaim> {
  const [won] = await txDb
    .update(invoicesTable)
    .set({ paidAt: new Date(), amountPaid: invoice.total })
    .where(
      and(
        eq(invoicesTable.id, invoice.id),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt)
      )
    )
    .returning();

  if (!won) {
    const [current] = await txDb
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice.id))
      .limit(1);
    return { claimed: false, invoice: current ?? invoice };
  }

  await emitEvent(txDb, { ...ctx, type: 'invoice.paid', payload: { reference: invoice.reference } });
  return { claimed: true, invoice: won };
}

/**
 * Atomically CLAIM a SHORT collection (partial collection enabled, 05). The CAS
 * additionally requires `amount_paid = 0` so ONLY the first partial collection
 * wins — a concurrent or redelivered short collect finds a non-zero `amount_paid`
 * and loses, so the collected-amount ledger entry posts exactly once (J6). Sets
 * `amount_paid` (collected) + `amount_remaining` (owed) but deliberately NOT
 * `paid_at`, so `deriveInvoiceStatus` reports `partially_paid` and 06 dunning
 * pursues `amount_remaining`. Emits `invoice.payment_partially_collected` only on a
 * winning claim; the winner then posts the collected-amount ledger entry.
 *
 * NOTE for 06 (dunning): the `partially_paid → paid` completion (a later retry that
 * collects the remainder) rides `claimInvoicePaid`, which is deliberately NOT gated
 * on `amount_paid = 0` — do not add that predicate, or a partial invoice could
 * never be completed. Concurrent partial-vs-full collects don't occur here because
 * collectForInvoice runs once per invoice per cycle and the rail dedups on our
 * reference (both see the same result).
 */
export async function claimInvoicePartiallyPaid(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  collected: number
): Promise<InvoicePaidClaim> {
  const amountRemaining = invoice.amountDue - collected;
  const [won] = await txDb
    .update(invoicesTable)
    .set({ amountPaid: collected, amountRemaining })
    .where(
      and(
        eq(invoicesTable.id, invoice.id),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt),
        eq(invoicesTable.amountPaid, 0)
      )
    )
    .returning();

  if (!won) {
    const [current] = await txDb
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice.id))
      .limit(1);
    return { claimed: false, invoice: current ?? invoice };
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_partially_collected',
    payload: { reference: invoice.reference, amountPaid: collected, amountRemaining },
  });
  return { claimed: true, invoice: won };
}

/**
 * Back-link the settlement/charge ledger transaction onto an already-claimed
 * invoice. Run by the claim winner immediately after posting the ledger entry, so
 * money moves only after the invoice has been exclusively claimed.
 */
export async function linkInvoiceLedgerTransaction(
  txDb: InfraTxDb,
  _ctx: DomainContext,
  invoice: InvoiceRow,
  ledgerTransactionId: string
): Promise<InvoiceRow> {
  const [updated] = await txDb
    .update(invoicesTable)
    .set({ ledgerTransactionId })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  return updated ?? invoice;
}
