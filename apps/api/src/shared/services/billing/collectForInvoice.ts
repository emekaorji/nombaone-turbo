import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow, type PaymentMethodRow } from '@nombaone/core-db/schema';
import { ensureSystemAccounts } from '@nombaone/sara/config';
import { emitEvent } from '@nombaone/sara/events';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';
import { coerceFailureReason } from '@nombaone/sara/nomba/failure-taxonomy';
import { getOrgBillingSettings } from '@nombaone/sara/org';
import { getRail, maybeSimulateTestCollect } from '@nombaone/sara/rails';

import { resolvePartialCollection } from '../proration';
import {
  claimInvoicePaid,
  claimInvoicePartiallyPaid,
  linkInvoiceLedgerTransaction,
} from '../invoices';
import { settleInvoicePayment } from '../settlement';
import { enterPastDue } from '../subscriptions';
import { enqueueCustomerEmail, loadCommsContext } from '../comms';
import { mintInvoiceCheckoutLink } from './actionLink';
import { loadSubscriptionRowById, railKeyForMethod, reconcilePaidSubEffects } from './effects';
import { buildRailCollectMetadata } from './railMetadata';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { RailPayInstructions } from '@nombaone/sara/rails';
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
  // (null on live ⇒ the real rail runs, unchanged). The metadata is built LAZILY —
  // only when the real rail will actually run — so the sandbox path stays
  // query-free; and it is built by the ONE shared builder, never hand-rolled
  // (the hand-rolled bag here is how every live charge shipped broken).
  const simulated = maybeSimulateTestCollect(ctx.mode, method, invoice.amountDue);
  const result =
    simulated ??
    (await getRail(railKeyForMethod(method.kind)).collect({
      ...ctx,
      reference: invoice.reference,
      amountKobo: invoice.amountDue,
      metadata: await buildRailCollectMetadata(txDb, ctx, { invoice, method }),
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
      // Credit the merchant's ledger balance for this collection: reclassify the
      // gross into our platform fee + `tenant_settlement:{ref}` (what we now owe
      // them). Idempotent on the invoice reference (`settlements.merchant_tx_ref`).
      // This is the ONLY thing that makes a merchant's money real — it runs for
      // every tenant now, unconditionally.
      await settleInvoicePayment(txDb, ctx, linked);
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

  // PUSH rail (or async pull) — the invoice stays open awaiting the inbound
  // confirm. If the rail told us WHERE the money should be pushed, persist it on
  // the invoice and tell the merchant: the rail used to return the NUBAN and the
  // engine dropped it on the floor, so no payer could ever learn where to pay.
  if (result.payInstructions) {
    const stamped = await persistPayInstructions(txDb, ctx, invoice, result.payInstructions);
    return { outcome: 'pending', invoice: stamped };
  }

  return { outcome: 'pending', invoice };
}

/**
 * Stamp a push rail's `payInstructions` (the per-invoice virtual NUBAN) into
 * `invoices.metadata.payInstructions` and emit `invoice.payment_instructions`
 * ONCE. Idempotent on the account number: the rail call itself is idempotent on
 * the invoice reference, so a re-collect returns the same NUBAN and we skip the
 * duplicate event rather than re-notifying.
 */
async function persistPayInstructions(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  payInstructions: RailPayInstructions
): Promise<InvoiceRow> {
  const existing = (invoice.metadata as Record<string, unknown> | null)?.payInstructions as
    | { accountNumber?: string }
    | undefined;
  if (existing?.accountNumber && existing.accountNumber === payInstructions.accountNumber) {
    return invoice;
  }

  const [stamped] = await txDb
    .update(invoicesTable)
    .set({
      metadata: {
        ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
        payInstructions: { ...payInstructions },
      },
    })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_instructions',
    payload: { reference: invoice.reference, payInstructions: { ...payInstructions } },
  });
  return stamped ?? invoice;
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

  // The bank wants the CUSTOMER, not the merchant — mail them the link directly.
  // Live-proven reality: most tokenized recharges step up to OTP, so this email
  // IS the primary card-renewal path, not an edge case.
  const comms = await loadCommsContext(txDb, ctx, invoice);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'payment_action_required',
    to: comms.email,
    dedupeKey: `${invoice.reference}:otp`,
    data: {
      amountKobo: invoice.amountDue - invoice.amountPaid,
      planName: comms.planName,
      merchantName: comms.merchantName,
      checkoutLink,
    },
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

/**
 * Mark a collection FAILED: bump the attempt, record the reason, and move the sub to
 * `past_due` so the dunning sweep picks it up and schedules attempt #1.
 *
 * Exported because the INBOUND path needs the identical behaviour: on live the card rail
 * answers `pending` and the decline arrives later as a `payment_failed` webhook, so the
 * async failure must land in exactly the same state as a synchronous one. Two separate
 * failure paths would drift — which is precisely how the async decline came to do nothing
 * at all.
 */
export async function failCollection(
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
