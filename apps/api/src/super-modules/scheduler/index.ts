import { Worker } from 'bullmq';

import { SCHEDULER_QUEUE_NAME, connection, enqueueBilling, upsertCron } from '@nombaone/queue';
import { runBillingSweep } from '@nombaone/sara/billing';

import { db } from '../../shared/config/db';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/observability/logger';

import type { SchedulerJobData, SchedulerJobResult } from '@nombaone/queue';

/**
 * ── The cron / scheduler skeleton (idempotent + replay-safe) ───────────────
 *
 * Two halves, both safe to run on EVERY boot:
 *
 *   1. REGISTRATION — `startScheduler()` upserts the repeatable jobs. Each uses a
 *      STABLE id (the task name) via BullMQ's Job Scheduler, so re-registering on
 *      every deploy updates the schedule IN PLACE rather than spawning duplicates
 *      (jobId = resourceId).
 *
 *   2. EXECUTION — a Worker on the scheduler queue that, on each tick, FINDS DUE
 *      WORK AND ACTS. The handler switches on `task`; a tick that finds nothing
 *      due is a no-op, and because the find-and-act query is itself idempotent, a
 *      replayed tick (BullMQ at-least-once) does not double-act.
 *
 * THIS is where the billing scheduler goes — the recurring sweep that finds
 * subscriptions due for renewal / invoices due for dunning and acts on them.
 * Billing is OUT OF SCOPE for this boilerplate, so the seam is left as a
 * documented switch case with no registered cron yet; wiring it is a matter of
 * adding an `upsertCron('billing-sweep', '<cron>')` call and a case below.
 */

/** Cap concurrency: scheduled sweeps are heavy and must not pile up. */
const SCHEDULER_CONCURRENCY = 1;

let worker: Worker<SchedulerJobData, SchedulerJobResult> | null = null;

/** Register every repeatable, idempotently. Add `upsertCron(...)` per task. */
const registerRepeatables = async (): Promise<void> => {
  // The billing sweep: find subscriptions due for renewal and fan out per-sub bill
  // jobs. Runs ~01:05 daily, before the 02:00 deterministic boundary. `upsertCron`
  // keeps exactly one scheduler per task id (jobId = task), so this is replay-safe.
  await upsertCron('billing-sweep', env.BILLING_SWEEP_CRON);
};

const createSchedulerWorker = (): Worker<SchedulerJobData, SchedulerJobResult> =>
  new Worker<SchedulerJobData, SchedulerJobResult>(
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const { task } = job.data;
      switch (task) {
        case 'billing-sweep': {
          // The tick only ENQUEUES (O(batches), fast); the billing worker drains the
          // fan-out and runs the claim-once charge per subscription (D.8).
          const { enqueued } = await runBillingSweep({
            db,
            now: new Date(),
            batchSize: env.BILLING_BATCH_SIZE,
            enqueue: (data) => enqueueBilling(data),
          });
          logger.info('[scheduler] billing-sweep enqueued', { enqueued, jobId: job.id });
          break;
        }
        default:
          // An unrecognized task is logged, not thrown: a stale repeatable from a
          // previous deploy should not poison the queue.
          logger.warn('[scheduler] no handler for task; skipping', { task, jobId: job.id });
      }
      return { task, ranAt: new Date().toISOString() };
    },
    { connection, concurrency: SCHEDULER_CONCURRENCY }
  );

export const startScheduler = async (): Promise<void> => {
  if (worker) {
    logger.warn('[scheduler] startScheduler called while already running; ignoring');
    return;
  }
  await registerRepeatables();
  worker = createSchedulerWorker();
  logger.info('[scheduler] started');
};

export const stopScheduler = async (): Promise<void> => {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info('[scheduler] stopped');
};
