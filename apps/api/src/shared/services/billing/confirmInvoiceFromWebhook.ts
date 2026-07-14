
import { ensureSystemAccounts } from '@nombaone/sara/config';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';

import { claimInvoicePaid, linkInvoiceLedgerTransaction, loadInvoiceRow } from '../invoices';
import { settleInvoicePayment } from '../settlement';
import {
  creditPaymentOnVoidedInvoice,
  reopenUncollectibleForPayment,
  reviveChurnedSubscription,
} from './latePayment';
import { reconcilePaidSubEffects } from './effects';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
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
  // E4: never trust the webhook — only a provider-confirmed requery that matches
  // our amount due is allowed to move money.
  if (verification.status !== 'settled' || verification.settledAmountKobo !== invoice.amountDue) {
    return { settled: false, invoice };
  }

  // ── 🔴 MONEY ARRIVED FOR AN INVOICE WE HAD ALREADY CLOSED ──────────────────
  //
  // This used to be a bare `if (voidedAt || uncollectibleAt) return { settled: false }`, above the
  // verification, with a comment claiming such a payment becomes "an out-of-band credit". No code
  // anywhere created that credit. So a confirmed, banked payment against a terminal invoice was
  // discarded: the customer charged, the merchant never credited, the ledger never moved.
  //
  // It is not hypothetical. Dunning hands the customer a Nomba pay-link, that link stays valid after
  // the ladder exhausts, and the ladder for a 10-minute plan exhausts in about half an hour. A
  // customer who pays 40 minutes late pays into a written-off invoice — and we ate it.
  //
  // Note this now sits BELOW the verification: we only act on money Nomba has actually confirmed.
  let working = invoice;

  if (invoice.voidedAt) {
    // The MERCHANT cancelled this bill. Settling it would overrule them — but keeping the money is
    // theft. Bank it as customer credit, consumed oldest-first by their next invoice.
    await creditPaymentOnVoidedInvoice(txDb, ctx, invoice, verification.settledAmountKobo);
    return { settled: false, invoice };
  }

  if (invoice.uncollectibleAt) {
    // WE gave up on this one; the customer did not. Paying an uncollectible invoice IS collecting
    // it — the exact outcome dunning spent four attempts chasing. Reopen it and settle it properly.
    working = await reopenUncollectibleForPayment(txDb, ctx, invoice);
  }

  // CLAIM before posting: two concurrent deliveries of the same settled webhook
  // resolve to one winner; the loser settles nothing (J6).
  const claim = await claimInvoicePaid(txDb, ctx, working);
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

  // If dunning had already churned this subscription over THIS invoice, bring it back: they have now
  // paid for the period, so they get the period. No-ops for a subscription the customer cancelled
  // themselves — a late payment must never re-subscribe someone who asked to leave.
  await reviveChurnedSubscription(txDb, ctx, linked);

  await reconcilePaidSubEffects(txDb, ctx, linked);

  // ⚠ THE MERCHANT'S MONEY. Without this the posting above leaves the whole gross
  // sitting in `platform_revenue` (a suspense account) and `tenant_settlement` is
  // never credited — the merchant's balance stays ₦0 forever and there is nothing
  // to pay out.
  //
  // This is THE production path, not an edge case: on live the card rail returns
  // `pending` (the charge settles asynchronously), and hosted checkout, the transfer
  // rail and OTP-completion all confirm here too. `collectForInvoice`'s synchronous
  // "succeeded" branch — the other place settlement is recorded — effectively only
  // runs under the sandbox simulator. So for real money, this call is the only one
  // that ever fires.
  //
  // Idempotent on the invoice reference (`settlements.merchant_tx_ref` unique +
  // claim-before-post), so a redelivered webhook credits nothing twice.
  await settleInvoicePayment(txDb, ctx, linked);

  return { settled: true, invoice: linked };
}
