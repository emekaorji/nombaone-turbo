import { enqueueBilling } from '@nombaone/queue';
import { runBillingSweep } from '@nombaone/sara/billing';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

/**
 * The billing-sweep tick: find subscriptions due for renewal and ENQUEUE one
 * bill job each (O(batches), fast — never charges inline). The billing worker
 * drains the fan-out and runs the claim-once charge per subscription (D.8).
 * Idempotent: a replayed tick re-finds the same due rows, and the
 * `subscription_periods` claim makes a second bill for a period a no-op.
 */
export async function handleBillingSweep(): Promise<{ enqueued: number }> {
  const { enqueued } = await runBillingSweep({
    db,
    now: new Date(),
    batchSize: env.BILLING_BATCH_SIZE,
    enqueue: (data) => enqueueBilling(data),
    // H7 ★: fair, per-tenant-budgeted selection so a huge-backlog tenant can't
    // starve a small one; 04's catch-up drains the rest across ticks.
    fair: { environment: env.INFRA_ENVIRONMENT },
  });
  logger.info('[cron] billing-sweep enqueued', { enqueued });
  return { enqueued };
}
