import { and, asc, eq } from 'drizzle-orm';

import {
  dunningAttemptsTable,
  invoicesTable,
  type DunningAttemptRow,
  type InvoiceRow,
  type PaymentMethodRow,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';

import { ensureSystemAccounts } from '../config';
import { emitEvent } from '../events';
import { claimInvoicePaid, linkInvoiceLedgerTransaction, markInvoiceUncollectible } from '../invoices';
import { ensureAccount, postTransaction } from '../ledger';
import { coerceFailureReason, type PaymentFailureReason } from '../nomba/failure-taxonomy';
import { getRail, maybeSimulateTestCollect } from '../rails';
import { mintReference } from '../reference';
import { churnFromPastDue, recoverFromPastDue } from '../subscriptions';
import { mintInvoiceCheckoutLink } from '../billing/actionLink';
import {
  loadSubscriptionRowById,
  railKeyForMethod,
  reconcilePaidSubEffects,
  resolveCollectionMethod,
} from '../billing/effects';
import { classifyDunningBranch } from './classify';
import { resolveBillingSettings } from './policy';
import { isDunningExhausted, nextPaydayBiasedAttemptAt, rawNextAttemptAt } from './schedule';

import type { DomainContext, InfraTxDb } from '../context';
import type { DunningBranch } from '@nombaone/core-contracts/types';
import type { ResolvedDunningPolicy } from './types';

interface ScheduleFirstAttemptInput {
  subscription: SubscriptionRow;
  invoice: InvoiceRow;
  reason: PaymentFailureReason;
  gatewayMessage?: string | null;
}

const nextAttemptInstant = (
  branch: DunningBranch,
  base: Date,
  attemptIndex: number,
  policy: ResolvedDunningPolicy
): Date | null => {
  if (branch === 'card_update_required') return null; // D4 — never a blind charge retry
  if (branch === 'short_path') return rawNextAttemptAt(base, attemptIndex, policy); // no payday bias
  return nextPaydayBiasedAttemptAt(base, attemptIndex, policy); // D12
};

const commsEventFor = (branch: DunningBranch): string =>
  branch === 'card_update_required' ? 'payment_method.expiring' : 'invoice.payment_failed';

async function loadInvoiceById(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string
): Promise<InvoiceRow | null> {
  const [row] = await txDb
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.environment, ctx.environment),
        eq(invoicesTable.id, invoiceId)
      )
    )
    .limit(1);
  return row ?? null;
}

/** The instant the FIRST dunning attempt for this invoice was recorded — the grace
 *  + max-window anchor (no separate `first_failed_at` column). */
async function firstFailureInstant(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string
): Promise<Date> {
  const [row] = await txDb
    .select({ createdAt: dunningAttemptsTable.createdAt })
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, ctx.organizationId),
        eq(dunningAttemptsTable.environment, ctx.environment),
        eq(dunningAttemptsTable.invoiceId, invoiceId)
      )
    )
    .orderBy(asc(dunningAttemptsTable.attemptNumber))
    .limit(1);
  return row?.createdAt ?? new Date();
}

/**
 * Start dunning for a `past_due` invoice: classify the first-failure reason into a
 * branch, insert the attempt-#1 row (D1/D11) and fire the customer comms ONCE
 * (D9 — `comms_sent_at` guard). Idempotent per invoice via
 * `unique(invoice_id, attempt_number)`: a second call (or a racing sweep) returns
 * the existing row and re-sends nothing.
 */
export async function scheduleFirstAttempt(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ScheduleFirstAttemptInput
): Promise<DunningAttemptRow | null> {
  const policy = await resolveBillingSettings(txDb, ctx);
  const branch = classifyDunningBranch(input.reason);
  const now = new Date();
  const status = branch === 'card_update_required' ? 'card_update_required' : 'scheduled';
  const commsEnabled = policy.commsEnabled;
  // OTP/3DS shares the card_update_required hold branch, but `collectForInvoice`
  // already emitted `invoice.action_required` (with the link) at the failing charge,
  // so dunning must NOT also emit the card-swap prompt for it.
  const isOtp = input.reason === 'otp_required';

  const [row] = await txDb
    .insert(dunningAttemptsTable)
    .values({
      reference: mintReference('DUN'),
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      subscriptionId: input.subscription.id,
      invoiceId: input.invoice.id,
      attemptNumber: 1,
      status,
      branch,
      failureReason: input.reason,
      gatewayMessage: input.gatewayMessage ?? null,
      scheduledAt: now,
      nextAttemptAt: nextAttemptInstant(branch, now, 0, policy),
      commsSentAt: commsEnabled ? now : null,
      commsEventType: commsEnabled ? (isOtp ? 'invoice.action_required' : commsEventFor(branch)) : null,
    })
    .onConflictDoNothing({
      target: [dunningAttemptsTable.invoiceId, dunningAttemptsTable.attemptNumber],
    })
    .returning();

  if (!row) {
    // Dunning already started for this invoice — return the existing #1, no comms.
    const [existing] = await txDb
      .select()
      .from(dunningAttemptsTable)
      .where(
        and(
          eq(dunningAttemptsTable.invoiceId, input.invoice.id),
          eq(dunningAttemptsTable.attemptNumber, 1)
        )
      )
      .limit(1);
    return existing ?? null;
  }

  // The collect path already emitted `invoice.payment_failed` at the failure. Dunning
  // adds only the NON-redundant comms: the card-update PROMPT on the card branch
  // (D5). Reschedule/short-path start silently (D9 — exactly one payment_failed).
  if (commsEnabled && branch === 'card_update_required' && !isOtp) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'payment_method.expiring',
      payload: { reference: input.invoice.reference, reason: input.reason },
    });
  }
  return row;
}

interface DunningChargeResult {
  outcome: 'succeeded' | 'failed' | 'pending' | 'requires_action';
  reason?: PaymentFailureReason;
  gatewayMessage?: string | null;
  invoice: InvoiceRow;
}

/**
 * Charge the OUTSTANDING amount of a dunning invoice through the rail, keyed on the
 * ATTEMPT's own reference (per-attempt idempotency key — a retry genuinely
 * re-attempts, and Nomba dedupes a replay of the SAME attempt, so no double-charge
 * J6/K4). On success, claim-before-post (the atomic paid CAS) settles the invoice.
 */
async function chargeDunningAttempt(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  method: PaymentMethodRow,
  attemptRef: string
): Promise<DunningChargeResult> {
  const outstanding = invoice.amountDue - invoice.amountPaid;
  if (outstanding <= 0) {
    const claim = await claimInvoicePaid(txDb, ctx, invoice);
    return { outcome: 'succeeded', invoice: claim.invoice };
  }

  await ensureSystemAccounts(txDb, ctx);
  const cash = await ensureAccount(txDb, ctx, { key: 'cash', kind: 'asset' });
  const platformRevenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });

  // TEST-MODE ONLY: a seeded test method short-circuits to a deterministic outcome
  // (null on live ⇒ the real rail runs, unchanged).
  const result =
    maybeSimulateTestCollect(ctx.environment, method, outstanding) ??
    (await getRail(railKeyForMethod(method.kind)).collect({
      ...ctx,
      reference: attemptRef,
      amountKobo: outstanding,
      metadata: {
        invoice: invoice.reference,
        paymentMethod: method.reference,
        tokenKey: method.tokenKey ?? undefined,
        customerId: method.customerId,
      },
    }));

  if (result.status === 'succeeded') {
    const claim = await claimInvoicePaid(txDb, ctx, invoice);
    if (!claim.claimed) return { outcome: 'succeeded', invoice: claim.invoice };
    const posted = await postTransaction(txDb, ctx, {
      kind: 'charge',
      memo: `dunning charge ${invoice.reference} (${attemptRef})`,
      entries: [
        { accountId: cash.id, direction: 'debit', amount: outstanding },
        { accountId: platformRevenue.id, direction: 'credit', amount: outstanding },
      ],
    });
    const linked = await linkInvoiceLedgerTransaction(txDb, ctx, claim.invoice, posted.transactionId);
    return { outcome: 'succeeded', invoice: linked };
  }

  if (result.status === 'requires_action') {
    // Bank OTP/3DS step-up on the retry — hold + prompt the customer, never blind-retry.
    return {
      outcome: 'requires_action',
      reason: 'otp_required',
      gatewayMessage: result.action?.message ?? null,
      invoice,
    };
  }

  if (result.status === 'failed') {
    return {
      outcome: 'failed',
      reason: coerceFailureReason(result.failureReason),
      gatewayMessage: result.failureReason ?? null,
      invoice,
    };
  }
  return { outcome: 'pending', invoice };
}

/**
 * Execute ONE due dunning attempt (the sweep's per-row step). Atomically CLAIMs the
 * row `scheduled → attempting` (only one worker wins — K4/J6), charges, and records
 * the outcome. Idempotent: a lost claim / non-scheduled row is a no-op, and an
 * invoice a concurrent flow already settled short-circuits to recovery.
 */
export async function executeDueAttempt(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow
): Promise<void> {
  const [claimed] = await txDb
    .update(dunningAttemptsTable)
    .set({ status: 'attempting', executedAt: new Date() })
    .where(and(eq(dunningAttemptsTable.id, attempt.id), eq(dunningAttemptsTable.status, 'scheduled')))
    .returning();
  if (!claimed) return; // lost the claim, or not scheduled — no-op

  const invoice = await loadInvoiceById(txDb, ctx, claimed.invoiceId);
  if (!invoice) return;
  const sub = await loadSubscriptionRowById(txDb, ctx, claimed.subscriptionId);

  // A concurrent webhook/collect already settled the invoice → recover + succeed.
  if (invoice.paidAt) {
    await finishAttempt(txDb, ctx, claimed, 'succeeded', 'recovered');
    await recoverSubscription(txDb, ctx, sub, invoice);
    return;
  }
  if (invoice.voidedAt || invoice.uncollectibleAt) {
    await finishAttempt(txDb, ctx, claimed, 'exhausted', 'invoice_terminal');
    return;
  }

  const method = await resolveCollectionMethod(txDb, ctx, sub);
  if (!method) {
    // No usable payment method → cannot charge; hold for a card update (D4-shaped).
    await toCardUpdateRequired(txDb, ctx, claimed, invoice, 'no_payment_method');
    return;
  }

  const charge = await chargeDunningAttempt(txDb, ctx, invoice, method, claimed.reference);
  await recordOutcome(txDb, ctx, { attempt: { ...claimed, railKey: railKeyForMethod(method.kind) }, sub, invoice, charge });
}

interface RecordOutcomeInput {
  attempt: DunningAttemptRow;
  sub: SubscriptionRow;
  invoice: InvoiceRow;
  charge: DunningChargeResult;
}

/**
 * Record a charged attempt's verified outcome and drive the branch (D3/D4/D8/D11):
 * success → recover; `card_update_required` → hold + prompt (no retry burned);
 * `short_path` → the courtesy retry is spent → churn; `reschedule` → schedule the
 * next payday-biased attempt unless the window/attempts are exhausted → churn.
 */
export async function recordOutcome(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: RecordOutcomeInput
): Promise<void> {
  const { attempt, sub, invoice, charge } = input;

  if (charge.outcome === 'succeeded') {
    await finishAttempt(txDb, ctx, attempt, 'succeeded', 'recovered');
    await recoverSubscription(txDb, ctx, sub, charge.invoice);
    return;
  }

  if (charge.outcome === 'pending') {
    // Awaiting server-side confirmation (async rail). Re-arm THIS attempt for a
    // recheck; the invoice may settle via the inbound webhook meanwhile, which the
    // next tick's `invoice.paidAt` short-circuit recovers. No new charge until then
    // (the rail dedupes on the attempt reference).
    const policy = await resolveBillingSettings(txDb, ctx);
    await txDb
      .update(dunningAttemptsTable)
      .set({
        status: 'scheduled',
        outcome: 'pending',
        nextAttemptAt: rawNextAttemptAt(new Date(), attempt.attemptNumber, policy),
      })
      .where(eq(dunningAttemptsTable.id, attempt.id));
    return;
  }

  if (charge.outcome === 'requires_action') {
    // Not a failure: the same card is fine, the bank just wants the customer to
    // authenticate. HOLD (like card_update_required — no blind retry) and prompt the
    // customer once with a fresh checkout link.
    await toActionRequired(txDb, ctx, attempt, invoice, charge.gatewayMessage ?? 'otp_required');
    return;
  }

  // A verified FAILURE — classify from the taxonomy bucket.
  const reason = charge.reason ?? 'unknown';
  const branch = classifyDunningBranch(reason);
  const now = new Date();
  const policy = await resolveBillingSettings(txDb, ctx);

  await txDb
    .update(dunningAttemptsTable)
    .set({ failureReason: reason, gatewayMessage: charge.gatewayMessage ?? null, railKey: attempt.railKey })
    .where(eq(dunningAttemptsTable.id, attempt.id));

  if (branch === 'card_update_required') {
    await toCardUpdateRequired(txDb, ctx, attempt, invoice, charge.gatewayMessage ?? reason);
    return;
  }

  const firstFailedAt = await firstFailureInstant(txDb, ctx, invoice.id);
  const exhausted =
    branch === 'short_path' || isDunningExhausted(attempt.attemptNumber, firstFailedAt, now, policy);

  if (exhausted) {
    await finishAttempt(txDb, ctx, attempt, 'exhausted', branch === 'short_path' ? 'hard_decline' : 'exhausted');
    await churnSubscription(txDb, ctx, sub, invoice);
    return;
  }

  // Reschedule: mark this attempt rescheduled + insert the next payday-biased one.
  await finishAttempt(txDb, ctx, attempt, 'rescheduled', 'rescheduled');
  await txDb
    .insert(dunningAttemptsTable)
    .values({
      reference: mintReference('DUN'),
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
      attemptNumber: attempt.attemptNumber + 1,
      status: 'scheduled',
      branch: 'reschedule',
      failureReason: reason,
      gatewayMessage: charge.gatewayMessage ?? null,
      railKey: attempt.railKey,
      scheduledAt: now,
      nextAttemptAt: nextAttemptInstant('reschedule', now, attempt.attemptNumber, policy),
    })
    .onConflictDoNothing({
      target: [dunningAttemptsTable.invoiceId, dunningAttemptsTable.attemptNumber],
    });
}

/** Stamp a terminal/interim status + outcome on an attempt row. */
async function finishAttempt(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow,
  status: 'succeeded' | 'rescheduled' | 'exhausted',
  outcome: string
): Promise<void> {
  await txDb
    .update(dunningAttemptsTable)
    .set({ status, outcome })
    .where(eq(dunningAttemptsTable.id, attempt.id));
}

/** Move an attempt to `card_update_required` and prompt the customer ONCE (D4/D5/D9). */
async function toCardUpdateRequired(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow,
  invoice: InvoiceRow,
  gatewayMessage: string
): Promise<void> {
  const policy = await resolveBillingSettings(txDb, ctx);
  const alreadyPrompted = attempt.commsSentAt != null;
  await txDb
    .update(dunningAttemptsTable)
    .set({
      status: 'card_update_required',
      branch: 'card_update_required',
      outcome: 'card_update_required',
      nextAttemptAt: null,
      gatewayMessage,
      ...(policy.commsEnabled && !alreadyPrompted
        ? { commsSentAt: new Date(), commsEventType: 'payment_method.expiring' }
        : {}),
    })
    .where(eq(dunningAttemptsTable.id, attempt.id));

  if (policy.commsEnabled && !alreadyPrompted) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'payment_method.expiring',
      payload: { reference: invoice.reference, reason: 'card_update_required' },
    });
  }
}

/**
 * Hold an attempt whose retry needs customer OTP/3DS (bank step-up) and prompt the
 * customer ONCE with a fresh hosted-checkout link. Mirrors `toCardUpdateRequired`'s
 * hold machinery (status `card_update_required`, `nextAttemptAt=null`, comms gate)
 * so the sweep never blind-retries — but the OUTCOME + comms event distinguish it as
 * a re-auth, not a card swap. The invoice settles via the normal inbound path when
 * the customer completes the `${ref}-otp` checkout.
 */
async function toActionRequired(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow,
  invoice: InvoiceRow,
  gatewayMessage: string
): Promise<void> {
  const policy = await resolveBillingSettings(txDb, ctx);
  const alreadyPrompted = attempt.commsSentAt != null;
  const checkoutLink = alreadyPrompted ? null : await mintInvoiceCheckoutLink(txDb, ctx, invoice);
  await txDb
    .update(dunningAttemptsTable)
    .set({
      status: 'card_update_required',
      branch: 'card_update_required',
      outcome: 'action_required',
      nextAttemptAt: null,
      gatewayMessage,
      ...(policy.commsEnabled && !alreadyPrompted
        ? { commsSentAt: new Date(), commsEventType: 'invoice.action_required' }
        : {}),
    })
    .where(eq(dunningAttemptsTable.id, attempt.id));

  if (policy.commsEnabled && !alreadyPrompted) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'invoice.action_required',
      payload: { reference: invoice.reference, reason: 'otp_required', checkoutLink },
    });
  }
}

/** Recovery (D8): the invoice is paid → return the sub to `active` + emit recovered. */
export async function recoverSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow,
  invoice: InvoiceRow
): Promise<void> {
  if (sub.status === 'past_due') {
    await recoverFromPastDue(txDb, ctx, sub);
  }
  await reconcilePaidSubEffects(txDb, ctx, invoice);
  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_recovered',
    payload: { reference: invoice.reference },
  });
}

/** Involuntary churn (D6/D13): mark the invoice uncollectible + churn the sub. */
export async function churnSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow,
  invoice: InvoiceRow
): Promise<void> {
  await markInvoiceUncollectible(txDb, ctx, invoice);
  if (sub.status === 'past_due') {
    await churnFromPastDue(txDb, ctx, sub);
  }
}

/**
 * After a card update mid-dunning (D10): flip the invoice's open
 * `card_update_required` attempt back to a `reschedule` due NOW, so the sweep
 * re-attempts immediately instead of waiting.
 */
export async function triggerReattemptNow(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string
): Promise<void> {
  const [held] = await txDb
    .select()
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, ctx.organizationId),
        eq(dunningAttemptsTable.environment, ctx.environment),
        eq(dunningAttemptsTable.invoiceId, invoiceId),
        eq(dunningAttemptsTable.status, 'card_update_required')
      )
    )
    .orderBy(asc(dunningAttemptsTable.attemptNumber))
    .limit(1);
  if (!held) return;
  await txDb
    .update(dunningAttemptsTable)
    .set({ status: 'scheduled', branch: 'reschedule', nextAttemptAt: new Date() })
    .where(eq(dunningAttemptsTable.id, held.id));
}

/**
 * On settlement of an invoice that had a HELD dunning attempt (`card_update_required`
 * — an expired-card update OR an OTP/3DS re-auth completed via the fresh checkout
 * link), close the attempt out as recovered and emit `invoice.payment_recovered`.
 * The settle path (`confirmInvoiceFromWebhook`) already recovered the subscription +
 * advanced the period, so this only closes the dunning artifact + emits the recovery
 * event (parity with the dunning-bridge path). No-op (returns false) when no held
 * attempt exists — fully idempotent on a redelivered webhook.
 */
export async function closeHeldAttemptsForInvoice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string,
  invoiceReference: string
): Promise<boolean> {
  const closed = await txDb
    .update(dunningAttemptsTable)
    .set({ status: 'succeeded', outcome: 'recovered' })
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, ctx.organizationId),
        eq(dunningAttemptsTable.environment, ctx.environment),
        eq(dunningAttemptsTable.invoiceId, invoiceId),
        eq(dunningAttemptsTable.status, 'card_update_required')
      )
    )
    .returning({ id: dunningAttemptsTable.id });
  if (closed.length === 0) return false;
  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.payment_recovered',
    payload: { reference: invoiceReference },
  });
  return true;
}
