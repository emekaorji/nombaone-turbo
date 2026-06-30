/**
 * Scheduled task ids. Each id below has a matching handler in
 * `super-modules/worker/workers/cron/jobs-handlers/` and a `case` in
 * `worker/workers/cron/index.ts`. The schedule itself is registered in
 * `scheduler/index.ts`. Adding a task = a constant here + an `upsertCron(...)`
 * registration + a handler routed in the cron worker.
 */

/** Find subscriptions due for renewal and fan out per-subscription bill jobs. */
export const BILLING_SWEEP_JOB = 'billing-sweep';

/** A6 incomplete-expiry + trial-will-end / payment-method-expiring notices. */
export const LIFECYCLE_SWEEP_JOB = 'lifecycle-sweep';
