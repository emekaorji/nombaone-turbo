import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { jobId } from './job-id';
import { defaultJobOptions } from './options';

export const BILLING_QUEUE_NAME = 'billing';

/**
 * One per-subscription renewal job, fanned out by the billing sweep (04 D.8). The
 * sweep tick only enqueues (O(batches), fast); these jobs drain in parallel and run
 * the 03 charge loop once per claimed period.
 */
export interface BillingJobData {
  subscriptionId: string;
  subscriptionReference: string;
  periodIndex: number;
  organizationId: string;
  mode: 'sandbox' | 'live';
}

export type BillingJobResult = {
  subscriptionId: string;
  outcome: string;
};

export const billingQueue = new Queue<BillingJobData, BillingJobResult>(BILLING_QUEUE_NAME, {
  connection,
  defaultJobOptions,
});

export const billingQueueEvents = new QueueEvents(BILLING_QUEUE_NAME, { connection });

/**
 * Enqueue a per-subscription bill job, keyed on (subscription, period) so the enqueue is
 * idempotent (BullMQ dedupes on jobId): an overlapping sweep that re-enqueues the same period
 * collapses onto one job — idempotency layer 3, on top of the `subscription_periods` claim and
 * the `invoices` unique constraint.
 *
 * 🔴 The id was `${subscriptionId}:${periodIndex}` — a template literal with a COLON, which BullMQ
 * rejects outright ("Custom Id cannot contain :"). Every call threw, so the billing sweep enqueued
 * NOTHING and no subscription ever renewed on its own. The sweep caught the error, logged
 * `[cron] job failed`, and looked for all the world like a quiet system with nothing due.
 * See `job-id.ts` — always pass the parts separately.
 */
export function enqueueBilling(data: BillingJobData) {
  return billingQueue.add(BILLING_QUEUE_NAME, data, {
    jobId: jobId(data.subscriptionId, data.periodIndex),
    // 🔴 FREE THE ID THE MOMENT THE JOB FINISHES.
    //
    // BullMQ's jobId dedupe is not a lock held only while a job is queued — it silently IGNORES
    // `add()` for any id that still EXISTS, including one sitting in the retained-completed set
    // (`removeOnComplete: {count: 1000, age: 24h}` by default). So a period that ran once and
    // finished WITHOUT being paid — the hosted-checkout `awaiting_payment` case, where the period
    // deliberately does not advance until money arrives — could never be enqueued again. The sweep
    // kept finding the subscription due, kept calling enqueueBilling, and BullMQ kept dropping it
    // on the floor. For up to 24 hours, on a plan that bills every 10 MINUTES.
    //
    // It bites hardest exactly when something changed and a retry would now SUCCEED: the customer
    // finished paying, or (as on live) their card token finally got attached. The retry that would
    // have collected the money is the one the dedupe throws away.
    //
    // Dropping the completed job restores the intended meaning: collapse the duplicate enqueues of
    // an IN-FLIGHT period, and nothing more. Real idempotency does not live here anyway — it lives
    // in the `subscription_periods` claim and the unique constraint on `invoices`, both of which
    // make a re-run of a period a no-op rather than a second charge.
    removeOnComplete: true,
  });
}
