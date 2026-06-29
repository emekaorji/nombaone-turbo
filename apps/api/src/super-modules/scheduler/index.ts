import { Worker } from 'bullmq';

import { SCHEDULER_QUEUE_NAME, connection, upsertCron } from '@nombaone/queue';

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
  // No cron tasks are registered in the boilerplate — billing (the first real
  // consumer) is out of scope. Register here, e.g.:
  //   await upsertCron('reconcile-ledger', '*/15 * * * *');
  //   await upsertCron('billing-sweep', '0 * * * *');
  // `upsertCron` keeps exactly one scheduler per task id, so this is replay-safe.
  void upsertCron; // keep the import live as the documented seam.
  await Promise.resolve();
};

const createSchedulerWorker = (): Worker<SchedulerJobData, SchedulerJobResult> =>
  new Worker<SchedulerJobData, SchedulerJobResult>(
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const { task } = job.data;
      switch (task) {
        // case 'billing-sweep':
        //   await runBillingSweep(); // find subscriptions/invoices due, act once.
        //   break;
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
