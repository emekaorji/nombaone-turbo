import { enqueueBilling } from '@nombaone/queue';
import { runBillingSweep } from '@/domain/billing';
import { ALL_MODES } from '@nombaone/sara/context';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';
import { markSweepCompleted } from '@shared/observability/prometheus';

/**
 * The billing-sweep tick: find subscriptions due for renewal and ENQUEUE one
 * bill job each (O(batches), fast — never charges inline). The billing worker
 * drains the fan-out and runs the claim-once charge per subscription (D.8).
 * ONE deployment serves both modes, so the tick runs the fair selection once per
 * mode over the shared DB. Idempotent: a replayed tick re-finds the same due rows,
 * and the `subscription_periods` claim makes a second bill for a period a no-op.
 */
export async function handleBillingSweep(): Promise<{ enqueued: number }> {
  const now = new Date();
  let enqueued = 0;
  for (const mode of ALL_MODES) {
    const result = await runBillingSweep({
      db,
      now,
      batchSize: env.BILLING_BATCH_SIZE,
      enqueue: (data) => enqueueBilling(data),
      // H7 ★: fair, per-tenant-budgeted selection so a huge-backlog tenant can't
      // starve a small one; 04's catch-up drains the rest across ticks.
      fair: { mode },
    });
    enqueued += result.enqueued;
    logger.info('[cron] billing-sweep enqueued', { mode, enqueued: result.enqueued });
  }
  await markSweepCompleted('billing-sweep');
  return { enqueued };
}
