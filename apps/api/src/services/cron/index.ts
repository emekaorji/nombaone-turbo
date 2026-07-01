import { upsertCron } from '@nombaone/queue';

import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

import { BILLING_SWEEP_JOB, DUNNING_SWEEP_JOB, LIFECYCLE_SWEEP_JOB } from './constants';

/**
 * ── The scheduler super-module — REGISTRATION ONLY ─────────────────────────
 *
 * This module's single job is to DECLARE the repeatable schedules. It owns no
 * BullMQ Worker: execution is routed to the worker super-module
 * (`worker/workers/cron/`), which drains the scheduler queue and dispatches each
 * tick to its handler. Keeping registration and execution apart means one place
 * (the worker supervisor) owns every Worker's lifecycle, so a SIGTERM drains
 * them all uniformly.
 *
 * `upsertCron` uses BullMQ's Job Scheduler (jobId = the task id), so exactly one
 * active entry exists per task — calling this on every boot, across instances,
 * is idempotent and never double-schedules. Add a task = a constant
 * (`scheduler/constants.ts`) + an `upsertCron(...)` here + a handler routed in
 * `worker/workers/cron/index.ts`.
 */
export async function initializeScheduler(): Promise<void> {
  // Billing sweep — ~01:05 daily, before the 02:00 deterministic boundary; the
  // tick only enqueues fan-out jobs, the billing worker does the charging.
  await upsertCron(BILLING_SWEEP_JOB, env.BILLING_SWEEP_CRON);
  // Lifecycle sweep — hourly, kept separate so a slow renewal run can't delay
  // the time-based notices.
  await upsertCron(LIFECYCLE_SWEEP_JOB, env.LIFECYCLE_SWEEP_CRON);
  // Dunning sweep — every 15m; idempotent so the exact minute is not load-bearing.
  await upsertCron(DUNNING_SWEEP_JOB, env.DUNNING_SWEEP_CRON);
  logger.info('[scheduler] repeatables registered', {
    [BILLING_SWEEP_JOB]: env.BILLING_SWEEP_CRON,
    [LIFECYCLE_SWEEP_JOB]: env.LIFECYCLE_SWEEP_CRON,
    [DUNNING_SWEEP_JOB]: env.DUNNING_SWEEP_CRON,
  });
}
