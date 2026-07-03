
import { ensureSystemAccounts } from '../config';
import { claimInvoicePaid, linkInvoiceLedgerTransaction, loadInvoiceRow } from '../invoices';
import { ensureAccount, postTransaction } from '../ledger';
import { reconcilePaidSubEffects } from './effects';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '../context';
import type { InboundVerification } from './types';

/**
 * The INBOUND-CONFIRM path (twin of `example/confirm`): a push-rail transfer (or an
 * async pull) settles out of band and Nomba notifies us. The webhook is an
 * UNTRUSTED hint — so the worker first **requeries** Nomba and passes the
 * provider-confirmed `verification` here. We settle ONLY when it is `settled` AND
 * the amount equals our `amount_due` (E4). Guarded against a second settlement on
 * an already-`paid` invoice (J6) and safe out of order. On settle: post a balanced
 * `settlement`, `markInvoicePaid`, and apply the paid-side FSM effects (recover
 * `past_due → active`, advance the period).
 */
export async function confirmInvoiceFromWebhook(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceReference: string,
  verification: InboundVerification
): Promise<{ settled: boolean; invoice: InvoiceRow }> {
  const invoice = await loadInvoiceRow(txDb, ctx, invoiceReference);

  // Already paid (J6, redelivered/out-of-order webhook): no second settlement — but
  // self-heal a paid-but-not-advanced subscription (a prior settle's period advance
  // lost a version race or crashed). applyPaidSubEffects is idempotent and only
  // advances while the sub is still at this invoice's period.
  if (invoice.paidAt) {
    await reconcilePaidSubEffects(txDb, ctx, invoice);
    return { settled: false, invoice };
  }
  // Void/uncollectible: a genuine late transfer is an out-of-band credit, not a
  // settlement of the terminal invoice.
  if (invoice.voidedAt || invoice.uncollectibleAt) {
    return { settled: false, invoice };
  }

  // E4: never trust the webhook — only a provider-confirmed requery that matches
  // our amount due is allowed to move money.
  if (verification.status !== 'settled' || verification.settledAmountKobo !== invoice.amountDue) {
    return { settled: false, invoice };
  }

  // CLAIM before posting: two concurrent deliveries of the same settled webhook
  // resolve to one winner; the loser settles nothing (J6).
  const claim = await claimInvoicePaid(txDb, ctx, invoice);
  if (!claim.claimed) {
    return { settled: false, invoice: claim.invoice };
  }

  await ensureSystemAccounts(txDb, ctx);
  const cash = await ensureAccount(txDb, ctx, { key: 'cash', kind: 'asset' });
  const platformRevenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });

  const memo = verification.providerReference
    ? `settle ${invoice.reference} (provider ${verification.providerReference})`
    : `settle ${invoice.reference}`;
  const posted = await postTransaction(txDb, ctx, {
    kind: 'settlement',
    memo,
    entries: [
      { accountId: cash.id, direction: 'debit', amount: invoice.amountDue },
      { accountId: platformRevenue.id, direction: 'credit', amount: invoice.amountDue },
    ],
  });

  const linked = await linkInvoiceLedgerTransaction(txDb, ctx, claim.invoice, posted.transactionId);
  await reconcilePaidSubEffects(txDb, ctx, linked);
  return { settled: true, invoice: linked };
}
