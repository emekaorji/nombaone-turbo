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

/** Nightly local↔Nomba reconcile: requery recent invoices, flag + self-heal drift (item 6). */
export const RECONCILE_NOMBA_JOB = 'reconcile-nomba';

/** Direct debit: poll `consent_pending` mandates → `active` once NIBSS advice is sent. */
export const MANDATE_ACTIVATION_SWEEP_JOB = 'mandate-activation-sweep';

/** Prune API request logs older than the retention window (Developers → Logs). */
export const REQUEST_LOG_RETENTION_JOB = 'request-log-retention';

/** Renewal reminders: "you will be billed in <lead>" — lead capped at one period. */
export const RENEWAL_REMINDER_JOB = 'renewal-reminder';

/** send_invoice overdue sweep: unpaid past-due invoices → past_due + payment-reminder dunning. */
export const OVERDUE_INVOICE_SWEEP_JOB = 'overdue-invoice-sweep';

/**
 * Awaiting-payment sweep: requery Nomba for invoices that are waiting on a payer and settle the ones
 * that have been paid. This is what makes an out-of-band payment (hosted checkout, bank transfer,
 * USSD) land WITHOUT depending on a provider webhook — which, on live, never arrives at all.
 */
export const AWAITING_PAYMENT_SWEEP_JOB = 'awaiting-payment-sweep';

/**
 * Daily settlement sweep: pay every merchant their available balance, once a day, to the
 * bank account they registered. Deterministic `merchantTxRef` per (org, mode, Lagos day)
 * makes a replayed tick a no-op.
 */
export const SETTLEMENT_SWEEP_JOB = 'settlement-sweep';

/**
 * Nightly ledger audit: zero-sum, suspense-zero (money attributed to nobody), and no
 * negative tenant balance. The only job whose purpose is to tell us a money bug shipped.
 */
export const LEDGER_RECONCILE_JOB = 'ledger-reconcile';
