import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { webhookJobOptions } from './options';

export const OUTBOUND_WEBHOOK_QUEUE_NAME = 'outbound-webhook';

/**
 * A single outbound webhook delivery attempt to a merchant/partner endpoint.
 */
export interface OutboundWebhookJobData {
  /** Unique delivery identifier issued when the delivery record is created. */
  deliveryReference: string;
  url: string;
  eventType: string;
  payload: Record<string, unknown>;
  /** Signing secret reference / key id, never the raw secret. */
  signingKeyId: string;
}

export type OutboundWebhookJobResult = {
  deliveryReference: string;
  statusCode: number;
  deliveredAt: string;
};

export const outboundWebhookQueue = new Queue<
  OutboundWebhookJobData,
  OutboundWebhookJobResult
>(OUTBOUND_WEBHOOK_QUEUE_NAME, {
  connection,
  defaultJobOptions: webhookJobOptions,
});

export const outboundWebhookQueueEvents = new QueueEvents(
  OUTBOUND_WEBHOOK_QUEUE_NAME,
  { connection },
);

/**
 * Enqueue an outbound webhook delivery idempotently.
 *
 * The `jobId` is the delivery reference, so re-enqueuing the same delivery
 * (e.g. on a retry-from-API or duplicate domain event) does not produce a
 * second delivery: jobId = resourceId.
 */
export function enqueueOutboundWebhook(data: OutboundWebhookJobData) {
  return outboundWebhookQueue.add(OUTBOUND_WEBHOOK_QUEUE_NAME, data, {
    // jobId = resourceId -> idempotent enqueue keyed on the delivery reference.
    jobId: data.deliveryReference,
  });
}
