import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
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
 * Enqueue a per-subscription bill job. `jobId = ${subscriptionId}:${periodIndex}`
 * makes the enqueue idempotent (BullMQ dedup): an overlapping sweep that re-enqueues
 * the same (subscription, period) collapses onto one job — idempotency layer 3, on
 * top of the `subscription_periods` claim and the `invoices` unique constraint.
 */
export function enqueueBilling(data: BillingJobData) {
  return billingQueue.add(BILLING_QUEUE_NAME, data, {
    jobId: `${data.subscriptionId}:${data.periodIndex}`,
  });
}
