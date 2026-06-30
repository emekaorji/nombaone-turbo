import { and, eq } from 'drizzle-orm';

import { subscriptionsTable, type SubscriptionRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { assertLegalTransition, DEFAULT_EVENT_FOR_STATUS } from './fsm';
import { getSubscriptionByReference, loadSubscriptionRow } from './queries';

import type { DomainContext, InfraTxDb } from '../context';
import type { SubscriptionResponseData, SubscriptionStatus } from './types';

type SubscriptionMutableFields = Partial<
  Pick<
    SubscriptionRow,
    | 'canceledAt'
    | 'endedAt'
    | 'pausedAt'
    | 'cancelAtPeriodEnd'
    | 'cancellationReason'
    | 'pauseMaxDays'
    | 'currentPeriodStart'
    | 'currentPeriodEnd'
    | 'currentPeriodIndex'
    | 'trialEnd'
  >
>;

interface TransitionOpts {
  event?: string;
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

/** Resume: shift the period end by the elapsed paused duration so no period is
 *  skipped or double-billed (A10). */
export async function resumeSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionResponseData> {
  const sub = await loadSubscriptionRow(txDb, ctx, reference);
  const set: SubscriptionMutableFields = { pausedAt: null };
  if (sub.pausedAt && sub.currentPeriodEnd) {
    const pausedMs = Date.now() - new Date(sub.pausedAt).getTime();
    set.currentPeriodEnd = new Date(new Date(sub.currentPeriodEnd).getTime() + pausedMs);
  }
  await transition(txDb, ctx, sub, 'active', { event: 'subscription.resumed', set });
  return getSubscriptionByReference(txDb, ctx, reference);
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
