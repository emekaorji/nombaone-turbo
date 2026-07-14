import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { jobId } from './job-id';
import { webhookJobOptions } from './options';

export const OUTBOUND_WEBHOOK_QUEUE_NAME = 'outbound-webhook';

/**
 * A nudge to drain the outbox, raised when a domain event fans out to a delivery row.
 *
 * The job carries no URL, payload or secret ON PURPOSE. The delivery row in Postgres is
 * the authoritative record; the worker re-reads it, so a job that sits in Redis across a
 * redeploy can never replay a stale body or POST to an endpoint the merchant has since
 * changed or disabled.
 */
export interface OutboundWebhookJobData {
  /** The delivery this job was raised for. Doubles as the jobId ⇒ enqueue is idempotent. */
  deliveryReference: string;
  /** Context for logs and tracing only — never used to build the request. */
  eventType: string;
  organizationId: string;
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
 * Events are almost always emitted INSIDE the transaction that produced them, so the delivery row
 * is not visible to another connection until that transaction commits. A job that ran instantly
 * would query, find nothing, and the merchant would wait for the cron. This short delay lets the
 * commit land first.
 *
 * It is a latency floor, not a correctness guarantee: the drain is a platform-wide sweep, so a
 * genuinely slow transaction is still swept by the next drain or by the cron.
 */
const COMMIT_GRACE_MS = 750;

/**
 * ── WHY THIS COALESCES ───────────────────────────────────────────────────────
 *
 * A drain job is NOT "deliver this one webhook" — `deliverPending` sweeps every due delivery on the
 * platform in one pass. So N jobs raised for N deliveries do not share the work N ways; they each
 * redo the whole sweep, and the first one to run usually delivers everything the others were raised
 * for, leaving them to wake up and find nothing.
 *
 * Keying the job on the delivery reference (which is what I did first) therefore produces one
 * redundant full-sweep per delivery. A subscription catching up a backlog emits thousands of events
 * in a burst, and the queue went to 600+ waiting jobs that all wanted to scan the same table —
 * starving the workers that had real work to do.
 *
 * Bucketing the id by the second collapses a burst into (at most) one drain per second, which is
 * all a sweep-shaped worker can usefully consume. Idempotency is unaffected: the delivery ROW is
 * the unit of work and the sweep is at-least-once against it, so dropping a redundant nudge cannot
 * drop a webhook. Worst case a delivery waits until the next second's drain, or the cron backstop.
 */
export function enqueueOutboundWebhook(data: OutboundWebhookJobData) {
  const bucket = Math.floor((Date.now() + COMMIT_GRACE_MS) / 1_000);

  return outboundWebhookQueue.add(OUTBOUND_WEBHOOK_QUEUE_NAME, data, {
    jobId: jobId('drain', bucket),
    delay: COMMIT_GRACE_MS,
    // Free the id as soon as the pass is done, so the NEXT second can enqueue its own drain.
    // Without this, a completed job lingers in the retained set and BullMQ silently ignores any
    // later add() that reuses the id — which would mean an event whose bucket collided with a
    // recent one never triggers a drain at all.
    removeOnComplete: true,
  });
}
