import type { InvoiceRow } from '@nombaone/core-db/schema';

import { ensureSystemAccounts } from '../config';
import { loadInvoiceRow, markInvoicePaid } from '../invoices';
import { ensureAccount, postTransaction } from '../ledger';
import { applyPaidSubEffects } from './effects';

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

  // Already settled — a redelivered/out-of-order webhook is a no-op (J6).
  if (invoice.paidAt) return { settled: false, invoice };

  // E4: never trust the webhook — only a provider-confirmed requery that matches
  // our amount due is allowed to move money.
  if (verification.status !== 'settled' || verification.settledAmountKobo !== invoice.amountDue) {
    return { settled: false, invoice };
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

  const paid = await markInvoicePaid(txDb, ctx, invoice, posted.transactionId);
  await applyPaidSubEffects(txDb, ctx, paid);
  return { settled: true, invoice: paid };
}
