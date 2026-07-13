import { recordSettlement } from './record';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * ── THE ONE RULE: an invoice that becomes PAID with real money credits the merchant.
 *
 * Call this from EVERY path that flips an invoice to paid. There must never again be a
 * second opinion about whether a merchant gets their money.
 *
 * That is not a stylistic preference — it is the exact bug this codebase shipped twice.
 * Three call sites each decided for themselves whether to settle, and they drifted:
 *   • `confirmInvoiceFromWebhook` (the ONLY settle path that runs on live, since the card
 *     rail confirms asynchronously) never called `recordSettlement` at all;
 *   • `collectForInvoice` called it, but behind a guard requiring a Nomba sub-account row
 *     no merchant could ever obtain, so it returned early for every tenant;
 *   • `dunning/attempt` — the RECOVERY path, the entire point of dunning — posted the
 *     charge and simply forgot to.
 * In each case the gross piled up in `platform_revenue` (a suspense account) and the
 * merchant's balance stayed ₦0 while their customers were being charged.
 *
 * ── What it does
 * `recordSettlement` splits the gross into our platform fee and the merchant's share,
 * crediting `tenant_settlement:{accountRef}` — the balance they can actually withdraw —
 * and drains `platform_revenue` back to zero.
 *
 * ── Why the full `amountDue`, not the amount of this particular payment
 * We settle the invoice's TOTAL when it becomes paid, however many payments it took (a
 * partial collection plus a dunning recovery of the remainder settles once, for the
 * whole). `settlements.merchant_tx_ref` is the invoice reference and is UNIQUE, so this
 * is idempotent by construction: a redelivered webhook, a racing collect and a retried
 * dunning attempt can all call it, and the merchant is credited exactly once.
 *
 * ── When it does nothing
 * A ₦0 invoice (free plan, or fully covered by credits/discounts) moves no money, so
 * there is nothing to split. Those are auto-paid at finalize and correctly settle nothing.
 */
export async function settleInvoicePayment(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  // No money changed hands ⇒ nothing to divide.
  if (invoice.amountDue <= 0) return;

  await recordSettlement(txDb, ctx, {
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    merchantTxRef: invoice.reference, // unique ⇒ credits at most once, from any path
    grossKobo: invoice.amountDue,
  });
}
