import { and, eq, isNotNull, isNull, gte } from 'drizzle-orm';

import { invoicesTable } from '@nombaone/core-db/schema';

import { confirmInvoiceFromWebhook, requeryInvoiceAtNomba } from '@shared/services/billing';
import { ensureSubscriptionChargeable } from '@shared/services/payment-methods';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { availableNombaModes, getNombaClient } from '@shared/config/nomba';
import { logger } from '@shared/observability/logger';
import { markSweepCompleted } from '@shared/observability/prometheus';

import type { InboundVerification } from '@shared/services/billing';

/**
 * ── ASK, DON'T WAIT ──────────────────────────────────────────────────────────
 *
 * A customer pays on a Nomba hosted page — by card, by bank transfer, by USSD. Nomba banks the
 * money. How does the engine find out?
 *
 * The design says: Nomba sends a webhook, the inbound worker requeries to verify it, the invoice
 * settles. That is a fine design, and it has exactly one load-bearing assumption — that the webhook
 * arrives. On the live account it never does. Not late; not sometimes. **Never.** Every webhook this
 * engine has ever processed on live is one it sent to itself.
 *
 * What was left holding the money path up was the nightly reconcile, which meant: a member pays, and
 * their membership starts working somewhere between now and 2am. For a plan that bills every ten
 * minutes, that is not a billing engine. And the `/welcome` page — which honestly polls, and honestly
 * refuses to say "you're in" until the money is real — would sit there spinning the whole time,
 * telling the truth about a system that had stopped listening.
 *
 * So this sweep stops waiting to be told. Every minute it takes the invoices that are actually
 * waiting on money — finalized, unpaid, not written off, recent — and asks Nomba directly whether
 * any of their orders settled. A webhook is a nice-to-have optimisation on top of this. It is not
 * the mechanism.
 *
 * It is deliberately the SAME code the webhook path runs: `requeryInvoiceAtNomba` (which knows every
 * order reference an invoice has ever had) → `confirmInvoiceFromWebhook` (which claims, posts to the
 * ledger, credits the merchant, and is idempotent). A payment therefore settles identically whether
 * we were told about it or found it ourselves — so there is no second, half-tested settlement path
 * to drift out of sync with the real one.
 */

/** Look back far enough to cover an abandoned-and-returned-to checkout, not so far that we rescan history. */
const LOOKBACK_MS = 6 * 60 * 60 * 1000;

export interface AwaitingPaymentResult {
  checked: number;
  settled: number;
}

export async function handleAwaitingPaymentSweep(): Promise<AwaitingPaymentResult> {
  let checked = 0;
  let settled = 0;

  const since = new Date(Date.now() - LOOKBACK_MS);

  for (const mode of availableNombaModes()) {
    const client = getNombaClient(mode);

    // Invoices genuinely waiting on a payer: billed, not paid, and recent enough that a human could
    // still be on the checkout page.
    //
    // UNCOLLECTIBLE invoices are deliberately INCLUDED. It is tempting to skip them — we wrote them
    // off, so why keep asking? — but that would skip the single most likely late payment there is.
    // Dunning's whole recovery play is to hand the customer a Nomba pay-link, and that link keeps
    // working after the retry ladder gives up. A customer who pays it an hour later is paying a
    // written-off invoice, and if nothing looks, their money is taken and nobody is told.
    // `confirmInvoiceFromWebhook` knows what to do with it (reopen, settle, revive the membership);
    // this is what gives it the chance.
    //
    // VOIDED invoices are left to the nightly reconcile: a merchant-cancelled bill being paid is
    // genuinely rare, and it resolves to a customer credit rather than a settlement, so it does not
    // need to be found within the minute.
    const waiting = await db
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.mode, mode),
          isNotNull(invoicesTable.finalizedAt),
          isNull(invoicesTable.paidAt),
          isNull(invoicesTable.voidedAt),
          gte(invoicesTable.updatedAt, since)
        )
      )
      .limit(env.BILLING_BATCH_SIZE);

    for (const invoice of waiting) {
      checked += 1;
      const ctx = { organizationId: invoice.organizationId, mode };

      try {
        const rq = await requeryInvoiceAtNomba(client, ctx, invoice);
        if (!rq.succeeded || typeof rq.amount !== 'number') continue;

        const verification: InboundVerification = {
          status: 'settled',
          settledAmountKobo: rq.amount,
          ...(rq.providerReference ? { providerReference: rq.providerReference } : {}),
        };

        const result = await confirmInvoiceFromWebhook(db, ctx, invoice.reference, verification);
        if (!result.settled) continue;

        settled += 1;
        logger.info('[cron] awaiting-payment: found a payment Nomba never told us about', {
          mode,
          invoice: invoice.reference,
          amountKobo: rq.amount,
          providerReference: rq.providerReference,
        });

        // They just paid on a hosted page, which means Nomba may now hold a card token for them.
        // Grab it, so the NEXT cycle can be silent instead of another link in their inbox.
        await ensureSubscriptionChargeable(db, ctx, result.invoice);
      } catch (error) {
        // One unhappy invoice must never stop the sweep — the rest of the book is still waiting.
        logger.warn('[cron] awaiting-payment: requery failed', {
          mode,
          invoice: invoice.reference,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await markSweepCompleted('awaiting-payment-sweep');
  if (settled > 0 || checked > 0) {
    logger.info('[cron] awaiting-payment-sweep ran', { checked, settled });
  }
  return { checked, settled };
}
