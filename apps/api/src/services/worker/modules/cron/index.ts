import { Worker } from 'bullmq';

import { SCHEDULER_QUEUE_NAME, connection } from '@nombaone/queue';

import { runWithCorrelation } from '@shared/observability/correlation';
import { logger } from '@shared/observability/logger';
import {
  BILLING_SWEEP_JOB,
  DUNNING_SWEEP_JOB,
  LIFECYCLE_SWEEP_JOB,
  MANDATE_ACTIVATION_SWEEP_JOB,
  RECONCILE_NOMBA_JOB,
  REQUEST_LOG_RETENTION_JOB,
  WEBHOOK_MAINTENANCE_JOB,
} from '@/services/cron/constants';

import { handleBillingSweep } from './jobs-handlers/billing-sweep';
import { handleDunningSweep } from './jobs-handlers/dunning-sweep';
import { handleLifecycleSweep } from './jobs-handlers/lifecycle-sweep';
import { handleMandateActivationSweep } from './jobs-handlers/mandate-activation-sweep';
import { handleReconcileNomba } from './jobs-handlers/reconcile-nomba';
import { handleRequestLogRetention } from './jobs-handlers/request-log-retention';
import { handleWebhookMaintenance } from './jobs-handlers/webhook-maintenance';

import type { SchedulerJobData, SchedulerJobResult } from '@nombaone/queue';

/**
 * ── Cron worker — drains the scheduler queue and routes each tick ──────────
 *
 * The scheduler super-module only DECLARES schedules; this worker EXECUTES them.
 * It dispatches by `task` to a handler in `jobs-handlers/`. Add a scheduled job
 * by registering its schedule in `scheduler/index.ts` and a `case` here.
 *
 * Concurrency is 1: sweeps are heavy find-and-act passes and must not pile up. A
 * tick that finds nothing due is a no-op, and because the find-and-act queries
 * are idempotent, a replayed tick (BullMQ at-least-once) does not double-act.
 */
const CRON_CONCURRENCY = 1;

export const createCronWorker = (): Worker<SchedulerJobData, SchedulerJobResult> => {
  const worker = new Worker<SchedulerJobData, SchedulerJobResult>(
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const { task } = job.data;
      return runWithCorrelation({ correlationId: job.id ?? task, task }, async () => {
        switch (task) {
          case BILLING_SWEEP_JOB:
            await handleBillingSweep();
            break;
          case LIFECYCLE_SWEEP_JOB:
            await handleLifecycleSweep();
            break;
          case DUNNING_SWEEP_JOB:
            await handleDunningSweep();
            break;
          case WEBHOOK_MAINTENANCE_JOB:
            await handleWebhookMaintenance();
            break;
          case RECONCILE_NOMBA_JOB:
            await handleReconcileNomba();
            break;
          case MANDATE_ACTIVATION_SWEEP_JOB:
            await handleMandateActivationSweep();
            break;
          case REQUEST_LOG_RETENTION_JOB:
            await handleRequestLogRetention();
            break;
          default:
            // A stale repeatable from a previous deploy should not poison the
            // queue — log and ack rather than throw.
            logger.warn('[cron] no handler for task; skipping', { task, jobId: job.id });
        }
        return { task, ranAt: new Date().toISOString() };
      });
    },
    { connection, concurrency: CRON_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.error('[cron] job failed', {
      task: job?.data.task,
      jobId: job?.id,
      attempt: job?.attemptsMade,
      error: error.message,
    });
  });

  return worker;
};
