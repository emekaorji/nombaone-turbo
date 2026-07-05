import { eq } from 'drizzle-orm';

import { paymentMethodsTable, subscriptionsTable } from '@nombaone/core-db/schema';

import { emitEvent } from '@nombaone/sara/events';
import { expireIncomplete } from '../subscriptions';
import {
  selectExpiredIncomplete,
  selectExpiringPaymentMethods,
  selectTrialEndingSoon,
} from './queries';

import type { DomainContext, Mode, InfraTxDb } from '@nombaone/sara/context';

export interface LifecycleSweepDeps {
  db: InfraTxDb;
  now: Date;
  incompleteExpiryWindowMs: number;
  trialNoticeWindowMs: number;
  pmExpiryNoticeWindowDays: number;
  batchSize: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ctxOf = (row: { organizationId: string; mode: Mode }): DomainContext => ({
  organizationId: row.organizationId,
  mode: row.mode,
});

/**
 * The time-based lifecycle sweep (D.10) — kept SEPARATE from the billing sweep so a
 * slow renewal run cannot delay notices. Three idempotent passes, none of which
 * move money:
 *  1. **A6 incomplete-expiry** — a never-paid `incomplete` subscription past its
 *     window flips to `incomplete_expired` (03's `expireIncomplete`; idempotent —
 *     a no-op on an already-expired row).
 *  2. **trial_will_end** notice — emit + stamp `trial_will_end_notified_at`, so a
 *     replayed tick emits nothing.
 *  3. **payment_method.expiring** notice — emit + stamp `expiring_notified_at`.
 * The transition + the two stamps make every pass replay-safe.
 */
export async function runLifecycleSweep(
  deps: LifecycleSweepDeps
): Promise<{ expired: number; trialNotices: number; pmNotices: number }> {
  let expired = 0;
  let trialNotices = 0;
  let pmNotices = 0;

  // Pass 1 — A6 incomplete expiry.
  const cutoff = new Date(deps.now.getTime() - deps.incompleteExpiryWindowMs);
  const incompletes = await selectExpiredIncomplete(deps.db, { cutoff, limit: deps.batchSize });
  for (const sub of incompletes) {
    await expireIncomplete(deps.db, ctxOf(sub), sub);
    expired += 1;
  }

  // Pass 2 — trial_will_end notice (emit once, stamped).
  const before = new Date(deps.now.getTime() + deps.trialNoticeWindowMs);
  const trials = await selectTrialEndingSoon(deps.db, { before, limit: deps.batchSize });
  for (const sub of trials) {
    await emitEvent(deps.db, {
      ...ctxOf(sub),
      type: 'subscription.trial_will_end',
      payload: { reference: sub.reference, trialEnd: sub.trialEnd?.toISOString() ?? null },
    });
    await deps.db
      .update(subscriptionsTable)
      .set({ trialWillEndNotifiedAt: deps.now })
      .where(eq(subscriptionsTable.id, sub.id));
    trialNotices += 1;
  }

  // Pass 3 — payment_method.expiring notice (emit once, stamped).
  const target = new Date(deps.now.getTime() + deps.pmExpiryNoticeWindowDays * DAY_MS);
  const targetYearMonth = target.getUTCFullYear() * 100 + (target.getUTCMonth() + 1);
  const methods = await selectExpiringPaymentMethods(deps.db, {
    targetYearMonth,
    limit: deps.batchSize,
  });
  for (const pm of methods) {
    await emitEvent(deps.db, {
      ...ctxOf(pm),
      type: 'payment_method.expiring',
      payload: { reference: pm.reference, expMonth: pm.expMonth, expYear: pm.expYear },
    });
    await deps.db
      .update(paymentMethodsTable)
      .set({ expiringNotifiedAt: deps.now })
      .where(eq(paymentMethodsTable.id, pm.id));
    pmNotices += 1;
  }

  return { expired, trialNotices, pmNotices };
}
