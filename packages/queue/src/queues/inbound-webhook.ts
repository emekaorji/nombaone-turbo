import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { jobId } from './job-id';
import { defaultJobOptions } from './options';

export const INBOUND_WEBHOOK_QUEUE_NAME = 'inbound-webhook';

/**
 * A provider-originated webhook accepted at the edge and queued for
 * asynchronous, durable processing.
 */
export interface InboundWebhookJobData {
  /** Source provider, e.g. a PSP or bank partner. */
  provider: string;
  /** The provider's own event id used for deduplication. */
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  /** Raw signature header, verified again before side effects. */
  signature: string | null;
  receivedAt: string;
}

export type InboundWebhookJobResult = {
  providerEventId: string;
  handled: boolean;
};

export const inboundWebhookQueue = new Queue<
  InboundWebhookJobData,
  InboundWebhookJobResult
>(INBOUND_WEBHOOK_QUEUE_NAME, {
  connection,
  defaultJobOptions,
});

export const inboundWebhookQueueEvents = new QueueEvents(
  INBOUND_WEBHOOK_QUEUE_NAME,
  { connection },
);

/**
 * Enqueue an inbound provider webhook idempotently.
 *
 * Providers retry deliveries, so the same event can arrive many times. Using
 * the provider event id as `jobId` makes the enqueue idempotent: a redelivered
 * event maps to the same job and is processed once. jobId = resourceId.
 */
export function enqueueInboundWebhook(data: InboundWebhookJobData) {
  return inboundWebhookQueue.add(INBOUND_WEBHOOK_QUEUE_NAME, data, {
    // jobId = resourceId -> idempotent enqueue keyed on the provider event id, collapsing
    // provider redeliveries onto a single job.
    //
    // Encoded, because this id is the ONE value here we do not control: it is whatever Nomba put
    // in the payload. The day a provider event id contains a ':' (a URN, a timestamp, a composite
    // key) this throws, and an inbound payment webhook is dropped on the floor — the customer is
    // charged and we never learn about it. Not a risk worth carrying for an external string.
    jobId: jobId(data.providerEventId),
  });
}
