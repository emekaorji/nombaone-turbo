import { and, asc, eq, or } from 'drizzle-orm';

import {
  dunningAttemptsTable,
  invoicesTable,
  type DunningAttemptRow,
  type InvoiceRow,
  type PaymentMethodRow,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';
import { ensureSystemAccounts } from '@nombaone/sara/config';
import { emitEvent } from '@nombaone/sara/events';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';
import { coerceFailureReason, type PaymentFailureReason } from '@nombaone/sara/nomba/failure-taxonomy';
import { getRail, maybeSimulateTestCollect } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';
import { cadenceApproxMs, isWallClockInterval } from '@nombaone/core-contracts/billing';

import { churnFromPastDue, recoverFromPastDue } from '../subscriptions';
import { claimInvoicePaid, linkInvoiceLedgerTransaction, markInvoiceUncollectible } from '../invoices';
import { settleInvoicePayment } from '../settlement';
import { ensureInvoiceCheckoutLink, mintInvoiceCheckoutLink } from '../billing/actionLink';
import { buildRailCollectMetadata } from '../billing/railMetadata';
import {
  buildUpdatePaymentMethodUrl,
  enqueueCustomerEmail,
  loadCommsContext,
} from '../comms';
import {
  loadPriceById,
  loadSubscriptionRowById,
  railKeyForMethod,
  reconcilePaidSubEffects,
  resolveCollectionMethod,
} from '../billing/effects';
import { classifyDunningBranch } from './classify';
import { resolveBillingSettings } from './policy';
import { isDunningExhausted, nextPaydayBiasedAttemptAt, rawNextAttemptAt } from './schedule';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
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
  // A payment reminder is a nudge, not a debit — payday timing is meaningless for
  // a push payer, and the ladder must track the (possibly sub-day) cadence.
  if (branch === 'payment_reminder') return rawNextAttemptAt(base, attemptIndex, policy);
  return nextPaydayBiasedAttemptAt(base, attemptIndex, policy); // D12
};

/**
 * The tenant's dunning policy, made CADENCE-AWARE for the subscription at hand.
 * `schedule.ts` is deliberately price-blind (org-level policy has no cadence), so
 * the decision lives here, where the subscription — and through it the price —
 * is in hand. For a WALL-CLOCK cadence (`minute × N`):
 *   • payday bias OFF — snapping a retry forward to 02:00 on the 26th would park
 *     a ten-minute plan for weeks;
 *   • each ladder rung is clamped to one period length — a ladder longer than
 *     the cadence freezes renewals (the sweep skips `past_due`) for multiples of
 *     the service period the customer actually bought.
 * Calendar cadences pass through untouched.
 */
async function resolveCadenceAwarePolicy(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<ResolvedDunningPolicy> {
  const policy = await resolveBillingSettings(txDb, ctx);
  const price = await loadPriceById(txDb, ctx, sub.priceId);
  if (!isWallClockInterval(price.interval)) return policy;

  const periodHours = cadenceApproxMs(price.interval, price.intervalCount) / 3_600_000;
  return {
    ...policy,
    paydayBiasEnabled: false,
    dunningIntervalsHours: policy.dunningIntervalsHours.map((h) => Math.min(h, periodHours)),
  };
}

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
        eq(invoicesTable.mode, ctx.mode),
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
        eq(dunningAttemptsTable.mode, ctx.mode),
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
  const policy = await resolveCadenceAwarePolicy(txDb, ctx, input.subscription);
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
      mode: ctx.mode,
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
  // (null on live ⇒ the real rail runs, unchanged). Metadata comes from the ONE
  // shared builder — this site used to hand-roll a bag that carried `tokenKey`
  // but neither `mandateId` nor `accountId` (so mandate retries failed closed and
  // card retries charged the un-webhooked parent pool), and sent our internal
  // UUID as Nomba's customerId. The rail's idempotency key stays the ATTEMPT ref
  // (fresh per retry — Nomba dedupes a replay of the SAME attempt only); the
  // metadata still names the invoice for reconciliation.
  const simulated = maybeSimulateTestCollect(ctx.mode, method, outstanding);
  const result =
    simulated ??
    (await getRail(railKeyForMethod(method.kind)).collect({
      ...ctx,
      reference: attemptRef,
      amountKobo: outstanding,
      metadata: await buildRailCollectMetadata(txDb, ctx, { invoice, method }),
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

    // 🔴 A RECOVERED PAYMENT IS STILL THE MERCHANT'S MONEY. This posted the charge and
    // stopped — so the whole gross of every successful recovery sat in `platform_revenue`
    // and the merchant was credited nothing. Recovering a failed payment is the entire
    // point of dunning; it must pay the merchant exactly like any other payment.
    await settleInvoicePayment(txDb, ctx, linked);

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
    if (sub.collectionMethod === 'send_invoice' || claimed.branch === 'payment_reminder') {
      // PUSH-rail dunning: there is nothing to charge — the "attempt" is a nudge.
      // The old behavior parked these on `card_update_required` with
      // `nextAttemptAt: null`, so a send_invoice subscription could NEVER churn:
      // it accrued unpaid invoices forever while reading `active`.
      await runPaymentReminderAttempt(txDb, ctx, claimed, sub, invoice);
    } else {
      // charge_automatically with a vanished/removed method → a card problem.
      await toCardUpdateRequired(txDb, ctx, claimed, invoice, 'no_payment_method');
    }
    return;
  }

  const charge = await chargeDunningAttempt(txDb, ctx, invoice, method, claimed.reference);
  await recordOutcome(txDb, ctx, { attempt: { ...claimed, railKey: railKeyForMethod(method.kind) }, sub, invoice, charge });
}

/**
 * One PUSH-rail dunning attempt: re-send the payment link (email + the
 * `invoice.payment_instructions`-adjacent nudge), then reschedule on the
 * cadence-aware ladder — or churn when the ladder is spent. No rail call ever
 * happens on this branch; the invoice settles via the inbound webhook when the
 * customer finally pays.
 */
async function runPaymentReminderAttempt(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow,
  sub: SubscriptionRow,
  invoice: InvoiceRow
): Promise<void> {
  const policy = await resolveCadenceAwarePolicy(txDb, ctx, sub);
  const now = new Date();
  const firstFailedAt = await firstFailureInstant(txDb, ctx, invoice.id);

  if (isDunningExhausted(attempt.attemptNumber, firstFailedAt, now, policy)) {
    await finishAttempt(txDb, ctx, attempt, 'exhausted', 'payment_overdue');
    await churnSubscription(txDb, ctx, sub, invoice);
    return;
  }

  // The nudge: same link the issue-time email carried (stamped on the invoice,
  // so no Nomba round-trip), re-sent with a per-attempt dedupe key.
  const { invoice: withLink, checkoutLink } = await ensureInvoiceCheckoutLink(txDb, ctx, invoice);
  const pi = (withLink.metadata as Record<string, unknown> | null)?.payInstructions as
    | Record<string, unknown>
    | undefined;
  const comms = await loadCommsContext(txDb, ctx, invoice);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'invoice_payment_link',
    to: comms.email,
    dedupeKey: `${invoice.reference}:remind:${attempt.attemptNumber}`,
    data: {
      amountKobo: invoice.amountDue - invoice.amountPaid,
      planName: comms.planName,
      merchantName: comms.merchantName,
      checkoutLink,
      dueAt: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : undefined,
      bankName: pi?.bankName,
      accountNumber: pi?.accountNumber,
      accountName: pi?.accountName,
    },
  });

  await finishAttempt(txDb, ctx, attempt, 'rescheduled', 'reminder_sent');
  await txDb
    .insert(dunningAttemptsTable)
    .values({
      reference: mintReference('DUN'),
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
      attemptNumber: attempt.attemptNumber + 1,
      status: 'scheduled',
      branch: 'payment_reminder',
      failureReason: 'invoice_overdue',
      railKey: attempt.railKey,
      scheduledAt: now,
      nextAttemptAt: nextAttemptInstant('payment_reminder', now, attempt.attemptNumber, policy),
    })
    .onConflictDoNothing({
      target: [dunningAttemptsTable.invoiceId, dunningAttemptsTable.attemptNumber],
    });
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

  // CAS-claim the attempt before acting. recordOutcome is reached from TWO
  // directions — the sweep's executor (attempt already `attempting`) and the
  // inbound-webhook dunning bridge (an async `pending` re-armed as `scheduled`).
  // Without this fence an inbound `payment_failed` landing on a HELD
  // `card_update_required` attempt re-classified it (→ blind retry, or a churn
  // nobody asked for), and a replayed webhook could double-drive a terminal row.
  const [claimed] = await txDb
    .update(dunningAttemptsTable)
    .set({ status: 'attempting' })
    .where(
      and(
        eq(dunningAttemptsTable.id, attempt.id),
        or(
          eq(dunningAttemptsTable.status, 'attempting'),
          and(eq(dunningAttemptsTable.status, 'scheduled'), eq(dunningAttemptsTable.outcome, 'pending'))
        )
      )
    )
    .returning({ id: dunningAttemptsTable.id });
  if (!claimed) return;

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
    const policy = await resolveCadenceAwarePolicy(txDb, ctx, sub);
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
  const policy = await resolveCadenceAwarePolicy(txDb, ctx, sub);

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
      mode: ctx.mode,
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

  // …and GIVE THE CUSTOMER A WAY TO PAY.
  //
  // Retrying is the only thing this branch used to do. That is a reasonable bet when the decline is
  // transient (no funds today, funds on payday) — and a guaranteed lost customer when it is not.
  // Live proved the "not" case is real and common: Nomba flatly refuses to charge a tokenized card
  // on this account (`PAYMENT_FAILED`, empty gateway message, every time), so the ladder would
  // retry a charge that CANNOT succeed, four times, and then churn a member who was perfectly
  // willing to pay and never once shown a button.
  //
  // A member whose payment failed has exactly one question — "how do I fix this?" — and until now
  // the honest answer was "you can't". So the first failure hands them a hosted-checkout link,
  // ONCE, while the retries continue behind it. Whichever lands first settles the invoice; both
  // paths are idempotent on the invoice claim, so there is no double charge.
  await offerSelfServePayment(txDb, ctx, attempt, invoice, charge.gatewayMessage ?? reason);
}

/**
 * Hand the customer a hosted-checkout link for a failed invoice, at most once per invoice.
 *
 * Deliberately does NOT hold the ladder (unlike `toActionRequired`): the retries keep running. This
 * is an OFFER, not a hand-off — if the bank starts approving the card again, the silent retry still
 * wins and the customer never has to do anything.
 */
async function offerSelfServePayment(
  txDb: InfraTxDb,
  ctx: DomainContext,
  attempt: DunningAttemptRow,
  invoice: InvoiceRow,
  gatewayMessage: string
): Promise<void> {
  const policy = await resolveBillingSettings(txDb, ctx);
  if (!policy.commsEnabled) return;

  // Once per INVOICE, not once per attempt — otherwise every rung of the ladder mints a new order
  // and re-mails the customer about a payment they have already been told about.
  const [alreadyOffered] = await txDb
    .select({ id: dunningAttemptsTable.id })
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.invoiceId, invoice.id),
        eq(dunningAttemptsTable.commsEventType, 'invoice.action_required')
      )
    )
    .limit(1);
  if (alreadyOffered) return;

  // A FRESH order reference — the invoice's own reference was burnt by the entry checkout, and each
  // charge attempt burnt its own. `-pay` is stripped back to the invoice by `invoiceRefFromOrderRef`
  // when the payment lands. Tokenize: they may pay with a different card, and that one might be
  // chargeable even when the current token is not.
  const checkoutLink = await mintInvoiceCheckoutLink(txDb, ctx, invoice, {
    refSuffix: '-pay',
    tokenizeCard: true,
  });
  if (!checkoutLink) return;

  await txDb
    .update(dunningAttemptsTable)
    .set({ commsSentAt: new Date(), commsEventType: 'invoice.action_required' })
    .where(eq(dunningAttemptsTable.id, attempt.id));

  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.action_required',
    payload: { reference: invoice.reference, reason: 'payment_failed', checkoutLink },
  });

  const comms = await loadCommsContext(txDb, ctx, invoice);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'invoice_payment_link',
    to: comms.email,
    dedupeKey: `${invoice.reference}:pay`,
    data: {
      amountKobo: invoice.amountDue - invoice.amountPaid,
      merchantName: comms.merchantName,
      reasonLine: gatewayMessage || undefined,
      actionUrl: checkoutLink,
    },
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
    // Mail the CUSTOMER too — the merchant webhook alone left the one person
    // who can fix a dead card uninformed. The action URL (the /pm page) is
    // attached by the comms layer when the checkout app is configured.
    const comms = await loadCommsContext(txDb, ctx, invoice);
    await enqueueCustomerEmail(txDb, ctx, {
      template: 'payment_method_update',
      to: comms.email,
      dedupeKey: `${invoice.reference}:card-update`,
      data: {
        amountKobo: invoice.amountDue - invoice.amountPaid,
        planName: comms.planName,
        merchantName: comms.merchantName,
        reasonLine: gatewayMessage || undefined,
        actionUrl: await buildUpdatePaymentMethodUrl(txDb, ctx, invoice),
      },
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
  const comms = await loadCommsContext(txDb, ctx, invoice);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'payment_recovered',
    to: comms.email,
    dedupeKey: `${invoice.reference}:recovered`,
    data: {
      amountKobo: invoice.amountDue,
      planName: comms.planName,
      merchantName: comms.merchantName,
    },
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
  const comms = await loadCommsContext(txDb, ctx, invoice);
  await enqueueCustomerEmail(txDb, ctx, {
    template: 'subscription_churned',
    to: comms.email,
    dedupeKey: `${invoice.reference}:churned`,
    data: {
      amountKobo: invoice.amountDue - invoice.amountPaid,
      planName: comms.planName,
      merchantName: comms.merchantName,
    },
  });
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
        eq(dunningAttemptsTable.mode, ctx.mode),
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
        eq(dunningAttemptsTable.mode, ctx.mode),
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
