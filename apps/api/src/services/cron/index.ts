import { upsertCron } from '@nombaone/queue';

import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

import {
  BILLING_SWEEP_JOB,
  DUNNING_SWEEP_JOB,
  LIFECYCLE_SWEEP_JOB,
  MANDATE_ACTIVATION_SWEEP_JOB,
  RECONCILE_NOMBA_JOB,
  REQUEST_LOG_RETENTION_JOB,
  WEBHOOK_MAINTENANCE_JOB,
} from './constants';

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
  // Webhook maintenance — drain due deliveries + auto-replay recovered dead-letters.
  await upsertCron(WEBHOOK_MAINTENANCE_JOB, env.WEBHOOK_MAINTENANCE_CRON);
  // Nomba reconcile — nightly; requeries recent invoices, flags + self-heals drift.
  await upsertCron(RECONCILE_NOMBA_JOB, env.RECONCILE_NOMBA_CRON);
  // Mandate activation — poll consent_pending direct-debit mandates → active.
  await upsertCron(MANDATE_ACTIVATION_SWEEP_JOB, env.MANDATE_ACTIVATION_SWEEP_CRON);
  // Request-log retention — nightly prune of request logs past the retention window.
  await upsertCron(REQUEST_LOG_RETENTION_JOB, env.REQUEST_LOG_RETENTION_CRON);
  logger.info('[scheduler] repeatables registered', {
    [BILLING_SWEEP_JOB]: env.BILLING_SWEEP_CRON,
    [LIFECYCLE_SWEEP_JOB]: env.LIFECYCLE_SWEEP_CRON,
    [DUNNING_SWEEP_JOB]: env.DUNNING_SWEEP_CRON,
    [WEBHOOK_MAINTENANCE_JOB]: env.WEBHOOK_MAINTENANCE_CRON,
    [RECONCILE_NOMBA_JOB]: env.RECONCILE_NOMBA_CRON,
    [MANDATE_ACTIVATION_SWEEP_JOB]: env.MANDATE_ACTIVATION_SWEEP_CRON,
    [REQUEST_LOG_RETENTION_JOB]: env.REQUEST_LOG_RETENTION_CRON,
  });
}
