import { eq } from 'drizzle-orm';

import { invoicesTable, type InvoiceRow, type PaymentMethodRow } from '@nombaone/core-db/schema';

import { ensureSystemAccounts } from '../config';
import { emitEvent } from '../events';
import { claimInvoicePaid, linkInvoiceLedgerTransaction } from '../invoices';
import { ensureAccount, postTransaction } from '../ledger';
import { getRail } from '../rails';
import { enterPastDue } from '../subscriptions';
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

  const result = await getRail(railKeyForMethod(method.kind)).collect({
    ...ctx,
    reference: invoice.reference,
    amountKobo: invoice.amountDue,
    metadata: { invoice: invoice.reference, paymentMethod: method.reference },
  });

  if (result.status === 'succeeded') {
    // CLAIM before posting: only the winner of the atomic claim moves money, so a
    // concurrent inbound confirm (or a racing collect) cannot double-post (J6). The
    // rail itself dedups on our reference, so the external charge happened once.
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
    return { outcome: 'paid', invoice: linked };
  }

  if (result.status === 'failed') {
    const failed = await failCollection(txDb, ctx, invoice, result.failureReason);
    return { outcome: 'past_due', invoice: failed };
  }

  return { outcome: 'pending', invoice };
}

async function failCollection(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  reason: string | undefined
): Promise<InvoiceRow> {
  const [bumped] = await txDb
    .update(invoicesTable)
    .set({ attemptCount: invoice.attemptCount + 1 })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();

  if (invoice.subscriptionId) {
    const sub = await loadSubscriptionRowById(txDb, ctx, invoice.subscriptionId);
    // active or trial-end charge failed → past_due (06 dunning). An `incomplete`
    // first charge stays incomplete (its retry/expiry window is 04's sweep).
    if (sub.status === 'active' || sub.status === 'trialing') {
      await enterPastDue(txDb, ctx, sub);
    }
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_failed',
    payload: { reference: invoice.reference, reason: reason ?? null },
  });
  return bumped ?? invoice;
}
