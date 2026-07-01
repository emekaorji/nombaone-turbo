/**
 * Scheduled task ids. Each id below has a matching handler in
 * `services/worker/modules/cron/jobs-handlers/` and a `case` in
 * `services/worker/modules/cron/index.ts`. The schedule itself is registered in
 * `services/cron/index.ts`. Adding a task = a constant here + an `upsertCron(...)`
 * registration + a handler routed in the cron worker.
 */

/** Find subscriptions due for renewal and fan out per-subscription bill jobs. */
export const BILLING_SWEEP_JOB = 'billing-sweep';

/** A6 incomplete-expiry + trial-will-end / payment-method-expiring notices. */
export const LIFECYCLE_SWEEP_JOB = 'lifecycle-sweep';

/** Dunning: start dunning for new past_due invoices + run every due retry (06). */
export const DUNNING_SWEEP_JOB = 'dunning-sweep';

/** Outbound webhooks: drain due deliveries + auto-replay recovered dead-letters (07). */
export const WEBHOOK_MAINTENANCE_JOB = 'webhook-maintenance';
