import { Worker } from 'bullmq';

import { OUTBOUND_WEBHOOK_QUEUE_NAME, connection } from '@nombaone/queue';
import { deliverPending } from '@nombaone/sara/webhooks';

import { db } from '../../../shared/config/db';
import { logger } from '../../../shared/observability/logger';

import type { OutboundWebhookJobData, OutboundWebhookJobResult } from '@nombaone/queue';

/**
 * ── Outbound webhook delivery worker (us → tenant) ─────────────────────────
 *
 * `emitEvent` writes delivery INTENT (`pending` rows); this worker turns intent
 * into HTTP by draining due deliveries via sara's `deliverPending` (signed POST,
 * exponential backoff, dead-letter on exhaustion). The drain is platform-wide
 * (not tenant-scoped) and at-least-once — receivers dedupe on the event id.
 *
 * Each job triggers one bounded drain pass; the queue's repeatable scheduler (or
 * the per-event enqueue) keeps work flowing. Concurrency is capped low: delivery
 * is I/O-bound on remote endpoints, and the drain itself batches internally, so
 * a few concurrent passes saturate throughput without hammering the DB.
 */

/** Delivery is I/O-bound and self-batching; a small cap is plenty. */
const OUTBOUND_CONCURRENCY = 5;
/** Deliveries drained per job pass. */
const DRAIN_BATCH = 50;

export const createOutboundWebhookWorker = (): Worker<
  OutboundWebhookJobData,
  OutboundWebhookJobResult
> => {
  const worker = new Worker<OutboundWebhookJobData, OutboundWebhookJobResult>(
    OUTBOUND_WEBHOOK_QUEUE_NAME,
    async (job) => {
      const result = await deliverPending(db, { limit: DRAIN_BATCH });
      logger.info('[worker] outbound-webhook drain', {
        jobId: job.id,
        ...result,
      });
      return {
        deliveryReference: job.data.deliveryReference,
        statusCode: result.failed === 0 ? 200 : 207,
        deliveredAt: new Date().toISOString(),
      };
    },
    { connection, concurrency: OUTBOUND_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] outbound-webhook job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
};
