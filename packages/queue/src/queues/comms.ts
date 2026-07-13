import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { defaultJobOptions } from './options';

export const COMMS_QUEUE_NAME = 'comms';

/**
 * One END-CUSTOMER email, enqueued at the billing/dunning moment that warrants
 * it. The trigger sites pass rich, already-resolved payloads (amounts, links,
 * NUBANs) so the worker never re-queries the money path — sending mail must not
 * be able to fail a charge, and a charge must not wait on SMTP.
 */
export interface CommsJobData {
  organizationId: string;
  mode: 'sandbox' | 'live';
  /** The template key — see apps/api comms/templates. */
  template:
    | 'renewal_upcoming'
    | 'payment_action_required'
    | 'payment_method_update'
    | 'invoice_payment_link'
    | 'payment_recovered'
    | 'subscription_churned';
  to: string;
  /** Template variables (amounts in kobo, ISO dates, links). */
  data: Record<string, unknown>;
}

export type CommsJobResult = { delivered: boolean };

export const commsQueue = new Queue<CommsJobData, CommsJobResult>(COMMS_QUEUE_NAME, {
  connection,
  defaultJobOptions,
});

export const commsQueueEvents = new QueueEvents(COMMS_QUEUE_NAME, { connection });

/**
 * Enqueue one email. `dedupeKey` makes the enqueue idempotent per intent (e.g.
 * `renewal_upcoming:<subId>:<periodIndex>`) — a re-running sweep collapses onto
 * one job instead of re-mailing the customer.
 */
export function enqueueComms(data: CommsJobData, dedupeKey: string) {
  return commsQueue.add(COMMS_QUEUE_NAME, data, { jobId: `${data.template}:${dedupeKey}` });
}
