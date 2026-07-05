import { ALL_MODES } from '@nombaone/sara/context';
import { runDunningSweep } from '@shared/services/dunning';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';
import { markSweepCompleted } from '@shared/observability/prometheus';

/**
 * The dunning-sweep tick (06): start dunning for newly-detected past_due invoices
 * and run every due retry. ONE deployment serves both modes, so the tick sweeps
 * each mode's slice of the shared DB in turn. Idempotent — the attempt claim +
 * `unique(invoice_id, attempt_number)` mean a replayed tick double-acts on nothing
 * (K4/J6).
 */
export async function handleDunningSweep(): Promise<void> {
  const now = new Date();
  for (const mode of ALL_MODES) {
    const result = await runDunningSweep({
      db,
      mode,
      now,
      batchSize: env.BILLING_BATCH_SIZE,
    });
    logger.info('[cron] dunning-sweep ran', { mode, ...result });
  }
  await markSweepCompleted('dunning-sweep');
}
