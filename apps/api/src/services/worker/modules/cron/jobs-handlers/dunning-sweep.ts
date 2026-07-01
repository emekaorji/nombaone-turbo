import { runDunningSweep } from '@nombaone/sara/dunning';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

/**
 * The dunning-sweep tick (06): start dunning for newly-detected past_due invoices
 * and run every due retry. Idempotent — the attempt claim + `unique(invoice_id,
 * attempt_number)` mean a replayed tick double-acts on nothing (K4/J6).
 */
export async function handleDunningSweep(): Promise<void> {
  const result = await runDunningSweep({
    db,
    environment: env.INFRA_ENVIRONMENT,
    now: new Date(),
    batchSize: env.BILLING_BATCH_SIZE,
  });
  logger.info('[cron] dunning-sweep ran', { ...result });
}
