import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow, type PaymentMethodRow } from '@nombaone/core-db/schema';

import { ensureSystemAccounts } from '../config';
import { emitEvent } from '../events';
import {
  claimInvoicePaid,
  claimInvoicePartiallyPaid,
  linkInvoiceLedgerTransaction,
} from '../invoices';
import { ensureAccount, postTransaction } from '../ledger';
import { coerceFailureReason } from '../nomba/failure-taxonomy';
import { getOrgBillingSettings } from '../org';
import { resolvePartialCollection } from '../proration';
import { getRail, maybeSimulateTestCollect } from '../rails';
import { findTenantSubAccount, recordSettlement } from '../settlement';
import { enterPastDue } from '../subscriptions';
import { mintInvoiceCheckoutLink } from './actionLink';
import { loadSubscriptionRowById, railKeyForMethod, reconcilePaidSubEffects } from './effects';

import type { DomainContext, InfraTxDb } from '../context';
import type { CollectResult } from './types';

/**
 * The real-domain MONEY PATH (the twin of `example/create`'s rail+ledger steps).
 * For a finalized invoice with `amount_due > 0`:
 *
 *  1. provision the well-known accounts (cash / accounts_receivable / platform_revenue);
 *  2. `getRail(railKeyForMethod(kind)).collect(...)` keyed on **our** invoice reference;
 *  3. **PULL succeeded** → post a balanced `charge` (debit cash, credit revenue),
 *     `markInvoicePaid` (linking the ledger tx), and apply the paid-side FSM effects
 *     (activate/recover + advance period);
 *  4. **PULL failed** → bump `attempt_count`, move the sub `→ past_due` (06 takes
 *     over), emit `invoice.payment_failed`;
 *  5. **pending / PUSH** → leave the invoice `open` and await the inbound confirm.
 *
 * A ₦0 invoice short-circuits to paid with NO rail call (J8). Never trusts a client
 * success for a push rail (E4 — settlement is the inbound confirm's job).
 */
export async function collectForInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  method: PaymentMethodRow
): Promise<CollectResult> {
  if (invoice.amountDue === 0) {
    const claim = await claimInvoicePaid(txDb, ctx, invoice);
    if (claim.claimed) await reconcilePaidSubEffects(txDb, ctx, claim.invoice);
    return { outcome: 'paid', invoice: claim.invoice };
  }

  await ensureSystemAccounts(txDb, ctx);
  const cash = await ensureAccount(txDb, ctx, { key: 'cash', kind: 'asset' });
  await ensureAccount(txDb, ctx, { key: 'accounts_receivable', kind: 'asset' });
  const platformRevenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });

  // TEST-MODE ONLY: a seeded test method short-circuits to a deterministic outcome
  // (null on live ⇒ the real rail runs, unchanged).
  const result =
    maybeSimulateTestCollect(ctx.mode, method, invoice.amountDue) ??
    (await getRail(railKeyForMethod(method.kind)).collect({
      ...ctx,
      reference: invoice.reference,
      amountKobo: invoice.amountDue,
      metadata: { invoice: invoice.reference, paymentMethod: method.reference },
    }));

  if (result.status === 'succeeded') {
    const collected = result.collectedKobo ?? invoice.amountDue;

    // FULL collection (the all-or-nothing common case — card token, full debit).
    // CLAIM before posting: only the winner of the atomic claim moves money, so a
    // concurrent inbound confirm (or a racing collect) cannot double-post (J6). The
    // rail itself dedups on our reference, so the external charge happened once.
    if (collected >= invoice.amountDue) {
      const claim = await claimInvoicePaid(txDb, ctx, invoice);
      if (!claim.claimed) {
        return { outcome: 'paid', invoice: claim.invoice };
      }
      const posted = await postTransaction(txDb, ctx, {
        kind: 'charge',
        memo: `charge ${invoice.reference}`,
        entries: [
          { accountId: cash.id, direction: 'debit', amount: invoice.amountDue },
          { accountId: platformRevenue.id, direction: 'credit', amount: invoice.amountDue },
        ],
      });
      const linked = await linkInvoiceLedgerTransaction(txDb, ctx, claim.invoice, posted.transactionId);
      await reconcilePaidSubEffects(txDb, ctx, linked);
      // H5: settle the verified collection through the tenant's sub-account split
      // (best-effort — only tenants onboarded to a sub-account settle; others are
      // unaffected). Idempotent on the invoice reference (merchant_tx_ref).
      await settleCollectionIfConfigured(txDb, ctx, linked);
      return { outcome: 'paid', invoice: linked };
    }

    // SHORT collection. Tenant policy (05, off by default) decides the outcome.
    const settings = await getOrgBillingSettings(txDb, ctx);
    const policy = resolvePartialCollection(
      settings.partialCollectionEnabled,
      invoice.amountDue,
      collected
    );

    // ENABLED + a genuine partial (collected > 0) → bank the collected kobo, track
    // the remainder as `partially_paid`, and move the sub → past_due so 06 dunning
    // pursues `amount_remaining`. Claim-before-post (amount_paid = 0 CAS) makes the
    // collected-amount ledger entry post exactly once.
    if (policy.status === 'partially_paid' && collected > 0) {
      const claim = await claimInvoicePartiallyPaid(txDb, ctx, invoice, collected);
      if (!claim.claimed) {
        return { outcome: 'past_due', invoice: claim.invoice };
      }
      const posted = await postTransaction(txDb, ctx, {
        kind: 'charge',
        memo: `partial charge ${invoice.reference}`,
        entries: [
          { accountId: cash.id, direction: 'debit', amount: collected },
          { accountId: platformRevenue.id, direction: 'credit', amount: collected },
        ],
      });
      const linked = await linkInvoiceLedgerTransaction(txDb, ctx, claim.invoice, posted.transactionId);
      // Persist the failure signal (a short collection = insufficient funds) so the
      // dunning sweep pursues the remainder on the right branch.
      await txDb
        .update(invoicesTable)
        .set({ lastFailureReason: 'insufficient_funds', lastGatewayMessage: 'partial_collection' })
        .where(eq(invoicesTable.id, invoice.id));
      // A remainder is owed → the sub is past_due (06 retries the remainder). No
      // attempt_count bump / payment_failed here: money DID arrive; the
      // `payment_partially_collected` event + `amount_remaining` carry the state.
      await moveActiveSubPastDue(txDb, ctx, linked);
      return { outcome: 'past_due', invoice: linked };
    }

    // DISABLED (or a degenerate zero-collection) → all-or-nothing failure. The
    // partial pull is NOT banked (reversal on the rail is an integration concern,
    // out of scope); the invoice stays `open` and the sub goes past_due (unchanged
    // from 03).
    const failed = await failCollection(txDb, ctx, invoice, result.failureReason ?? 'short_collection');
    return { outcome: 'past_due', invoice: failed };
  }

  if (result.status === 'requires_action') {
    await handleActionRequired(txDb, ctx, invoice, result.action?.message ?? 'otp_required');
    return { outcome: 'pending', invoice };
  }

  if (result.status === 'failed') {
    const failed = await failCollection(txDb, ctx, invoice, result.failureReason);
    return { outcome: 'past_due', invoice: failed };
  }

  return { outcome: 'pending', invoice };
}

/**
 * A card charge was ACCEPTED but the bank requires customer OTP/3DS (live-proven,
 * bank-gated). This is NOT a failure: don't bump `attempt_count` and don't emit
 * `payment_failed`. Mint a fresh hosted-checkout link, move the sub → past_due (06
 * dunning owns it, holding on `card_update_required` so it never blind-retries),
 * and emit `invoice.action_required` once so the tenant can send the customer the
 * link. The invoice stays `open`; the completion webhook (orderReference
 * `${ref}-otp`) settles it via the normal inbound path.
 */
async function handleActionRequired(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  gatewayMessage: string
): Promise<void> {
  const checkoutLink = await mintInvoiceCheckoutLink(txDb, ctx, invoice);
  await txDb
    .update(invoicesTable)
    .set({ lastFailureReason: 'otp_required', lastGatewayMessage: gatewayMessage })
    .where(eq(invoicesTable.id, invoice.id));
  await moveActiveSubPastDue(txDb, ctx, invoice);
  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.action_required',
    payload: { reference: invoice.reference, reason: 'otp_required', checkoutLink },
  });
}

/**
 * H5: settle a verified full collection through the tenant's sub-account split.
 * Best-effort and gated — only a tenant onboarded to a sub-account settles; the fee
 * engine + `recordSettlement` handle the rest (idempotent on the invoice reference).
 */
async function settleCollectionIfConfigured(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  if (!invoice.subscriptionId || invoice.amountDue <= 0) return;
  const sub = await findTenantSubAccount(txDb, ctx);
  if (!sub) return;
  await recordSettlement(txDb, ctx, {
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    merchantTxRef: invoice.reference,
    grossKobo: invoice.amountDue,
  });
}

/** Move an `active`/`trialing` subscription to `past_due` (06 dunning takes over).
 *  An `incomplete` first charge stays incomplete (its window is 04's sweep). */
async function moveActiveSubPastDue(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<void> {
  if (!invoice.subscriptionId) return;
  const sub = await loadSubscriptionRowById(txDb, ctx, invoice.subscriptionId);
  if (sub.status === 'active' || sub.status === 'trialing') {
    await enterPastDue(txDb, ctx, sub);
  }
}

async function failCollection(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  reason: string | undefined
): Promise<InvoiceRow> {
  const [bumped] = await txDb
    .update(invoicesTable)
    .set({
      attemptCount: invoice.attemptCount + 1,
      lastFailureReason: coerceFailureReason(reason),
      lastGatewayMessage: reason ?? null,
    })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();

  await moveActiveSubPastDue(txDb, ctx, invoice);

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_failed',
    payload: { reference: invoice.reference, reason: reason ?? null },
  });
  return bumped ?? invoice;
}
