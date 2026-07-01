import { runLifecycleSweep } from '@nombaone/sara/billing';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';
import { markSweepCompleted } from '@shared/observability/prometheus';

/**
 * The lifecycle-sweep tick (A6 + the proactive notices): expire never-paid
 * `incomplete` subscriptions past their window and emit trial-will-end /
 * payment-method-expiring notices. Each pass is stamped so a replayed tick
 * re-emits nothing (the transition is a no-op on an already-expired row).
 */
export async function handleLifecycleSweep(): Promise<void> {
  const result = await runLifecycleSweep({
    db,
    now: new Date(),
    incompleteExpiryWindowMs: env.INCOMPLETE_EXPIRY_WINDOW_HOURS * 3_600_000,
    trialNoticeWindowMs: env.TRIAL_NOTICE_WINDOW_HOURS * 3_600_000,
    pmExpiryNoticeWindowDays: env.PM_EXPIRY_NOTICE_WINDOW_DAYS,
    batchSize: env.BILLING_BATCH_SIZE,
  });
  await markSweepCompleted('lifecycle-sweep');
  logger.info('[cron] lifecycle-sweep ran', { ...result });
}
