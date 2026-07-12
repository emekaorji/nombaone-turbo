import { and, eq } from 'drizzle-orm';

import { pricesTable, subscriptionsTable, type SubscriptionRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';

import { computeAnchor, periodBounds, type PeriodPrice } from '../billing/scheduling';
import { assertLegalTransition, DEFAULT_EVENT_FOR_STATUS } from './fsm';
import { getSubscriptionByReference, loadSubscriptionRow } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { SubscriptionResponseData, SubscriptionStatus } from './types';
import type { WebhookEventType } from '@nombaone/core-contracts/types';

/**
 * The subscription's cadence (unit × count). Selected here rather than through
 * `billing/effects.loadPriceById` because that module imports back into `subscriptions`
 * — this file's own package — and the import would close a cycle. `billing/scheduling`
 * is a pure leaf, so importing the period math from it is safe.
 */
async function loadCadence(
  txDb: InfraTxDb,
  ctx: DomainContext,
  priceId: string
): Promise<PeriodPrice> {
  const [row] = await txDb
    .select({ interval: pricesTable.interval, intervalCount: pricesTable.intervalCount })
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.id, priceId)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.UnprocessableEntity(
      'the subscription references a price that no longer exists',
      { priceId },
      NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND
    );
  }
  return row;
}

type SubscriptionMutableFields = Partial<
  Pick<
    SubscriptionRow,
    | 'canceledAt'
    | 'endedAt'
    | 'pausedAt'
    | 'cancelAtPeriodEnd'
    | 'cancellationReason'
    | 'pauseMaxDays'
    | 'billingCycleAnchor'
    | 'currentPeriodStart'
    | 'currentPeriodEnd'
    | 'currentPeriodIndex'
    | 'nextBillingAt'
    | 'trialEnd'
  >
>;

interface TransitionOpts {
  event?: WebhookEventType;
  set?: SubscriptionMutableFields;
}

/**
 * The SINGLE writer of `subscriptions.status` (A3): asserts the edge is legal
 * (fsm), writes the new status + `version+1` under an **optimistic version guard**
 * (a stale version → `SUBSCRIPTION_VERSION_CONFLICT`, so a portal/scheduler race
 * cannot clobber), and emits the event. Idempotent (A14): re-issuing a transition
 * already in `to` is a no-op that returns the row unchanged.
 */
export async function transition(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow,
  to: SubscriptionStatus,
  opts: TransitionOpts = {}
): Promise<SubscriptionRow> {
  if (sub.status === to) return sub;
  assertLegalTransition(sub.status, to);

  const [updated] = await txDb
    .update(subscriptionsTable)
    .set({ status: to, version: sub.version + 1, ...(opts.set ?? {}) })
    .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
    .returning();

  if (!updated) {
    throw AppError.Conflict(
      'subscription was modified concurrently; retry',
      { reference: sub.reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: opts.event ?? DEFAULT_EVENT_FOR_STATUS[to],
    payload: { reference: sub.reference, status: to },
  });
  return updated;
}

// ── Public ops (reference → DTO) ─────────────────────────────────────────────

/** Cancel now (immediate, voluntary) or at period end (sets the flag, stays active). */
export async function cancelSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: { mode: 'now' | 'at_period_end' }
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);

  if (input.mode === 'at_period_end') {
    if (!sub.cancelAtPeriodEnd && sub.status !== 'canceled') {
      const [updated] = await txDb
        .update(subscriptionsTable)
        .set({ cancelAtPeriodEnd: true, version: sub.version + 1 })
        .where(and(eq(subscriptionsTable.id, sub.id), eq(subscriptionsTable.version, sub.version)))
        .returning();
      if (!updated) {
        throw AppError.Conflict(
          'subscription was modified concurrently; retry',
          { reference },
          NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT
        );
      }
      await emitEvent(txDb, {
        ...ctx,
        type: 'subscription.updated',
        payload: { reference, cancelAtPeriodEnd: true },
      });
    }
    return getSubscriptionByReference(txDb, ctx, reference);
  }

  const now = new Date();
  await transition(txDb, ctx, sub, 'canceled', {
    event: 'subscription.canceled',
    set: { canceledAt: now, endedAt: now, cancellationReason: 'voluntary' },
  });
  return getSubscriptionByReference(txDb, ctx, reference);
}

export async function pauseSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: { maxDays?: number }
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);
  await transition(txDb, ctx, sub, 'paused', {
    event: 'subscription.paused',
    set: { pausedAt: new Date(), pauseMaxDays: input.maxDays ?? null },
  });
  return getSubscriptionByReference(txDb, ctx, reference);
}

/**
 * Resume: push the whole future schedule out by the elapsed paused duration, so no
 * period is skipped or double-billed (A10).
 *
 * This shifts the ANCHOR, not just `current_period_end`. Every boundary is recomputed
 * from the anchor by `periodBounds`, so writing `current_period_end` alone (as this did)
 * was overwritten on the very next cycle — while `next_billing_at` kept its stale
 * pre-pause value, which made the subscription due the instant it came back. Moving the
 * anchor is what actually buys the customer back the time they were paused for.
 */
export async function resumeSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);
  const set: SubscriptionMutableFields = { pausedAt: null };

  if (sub.pausedAt) {
    const cadence = await loadCadence(txDb, ctx, sub.priceId);
    const pausedMs = Date.now() - new Date(sub.pausedAt).getTime();

    const oldAnchor =
      sub.billingCycleAnchor ??
      computeAnchor(sub.currentPeriodStart ?? new Date(), cadence.interval);
    // Re-normalize through computeAnchor so a calendar cadence stays pinned to the
    // billing hour (the shift is day-granular for those, exact for a wall-clock one).
    const anchor = computeAnchor(new Date(oldAnchor.getTime() + pausedMs), cadence.interval);
    // `currentPeriodIndex` is the NEXT index to bill, so its period START is both the
    // moment the paid coverage runs out and the moment the next charge is due.
    const nextBoundary = periodBounds(anchor, cadence, sub.currentPeriodIndex).start;

    set.billingCycleAnchor = anchor;
    set.currentPeriodEnd = nextBoundary;
    set.nextBillingAt = nextBoundary;
  }

  await transition(txDb, ctx, sub, 'active', { event: 'subscription.resumed', set });
  return getSubscriptionByReference(txDb, ctx, reference);
}

/**
 * The cancel-at-period-end trip. `cancelSubscription({ mode: 'at_period_end' })` only
 * RAISES the flag; this is what honors it, and `runCycle` is the only caller because it
 * is the only place that knows a period just ended. Honoring it anywhere else would
 * either cut the customer's paid time short or — as happened before this existed, when
 * nothing read the flag at all — renew a subscription they had already cancelled.
 *
 * Voluntary by definition (the customer asked), so it emits `subscription.canceled`,
 * never `subscription.churned`.
 */
export async function cancelAtBoundary(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  const now = new Date();
  return transition(txDb, ctx, sub, 'canceled', {
    event: 'subscription.canceled',
    set: { canceledAt: now, endedAt: now, cancellationReason: 'voluntary' },
  });
}

// ── Internal ops (row → row) — called by billing (03d) / dunning (06) ────────

export async function activateSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  return transition(txDb, ctx, sub, 'active', { event: 'subscription.activated' });
}

export async function enterPastDue(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  return transition(txDb, ctx, sub, 'past_due', { event: 'subscription.updated' });
}

export async function recoverFromPastDue(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  return transition(txDb, ctx, sub, 'active', { event: 'subscription.activated' });
}

export async function churnFromPastDue(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  const now = new Date();
  return transition(txDb, ctx, sub, 'canceled', {
    event: 'subscription.churned',
    set: { canceledAt: now, endedAt: now, cancellationReason: 'involuntary' },
  });
}

export async function expireIncomplete(
  txDb: InfraTxDb,
  ctx: DomainContext,
  sub: SubscriptionRow
): Promise<SubscriptionRow> {
  if (sub.status !== 'incomplete') return sub;
  return transition(txDb, ctx, sub, 'incomplete_expired', { event: 'subscription.updated' });
}
