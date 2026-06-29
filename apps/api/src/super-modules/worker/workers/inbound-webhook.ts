import { Worker } from 'bullmq';

import { INBOUND_WEBHOOK_QUEUE_NAME, connection } from '@nombaone/queue';

import { logger } from '../../../shared/observability/logger';

import type { InboundWebhookJobData, InboundWebhookJobResult } from '@nombaone/queue';

/**
 * ── Inbound webhook processing worker (provider → us, deferred) ────────────
 *
 * The webhook edge fast-acks and enqueues; THIS worker does the durable,
 * retryable processing the edge deliberately deferred. The discipline is
 * VERIFY-AGAIN-THEN-ACT: a valid signature only proved authenticity, so before
 * recording money the worker re-verifies against the provider (the provider's
 * "get transaction" API) and only then settles.
 *
 * The settlement seam is the documented stub below. A real build resolves OUR
 * reference from the provider payload and calls sara's
 * `confirmExampleFromWebhook(txDb, ctx, …)` (or the equivalent for your domain),
 * which re-verifies and posts the ledger settlement inside one transaction. The
 * jobId is the provider event id, so a redelivered event is processed once.
 *
 * Concurrency is capped: inbound processing hits the DB + provider API per job,
 * so we bound it to protect both.
 */

/** DB + provider-API bound per job; keep the cap modest. */
const INBOUND_CONCURRENCY = 5;

export const createInboundWebhookWorker = (): Worker<
  InboundWebhookJobData,
  InboundWebhookJobResult
> => {
  const worker = new Worker<InboundWebhookJobData, InboundWebhookJobResult>(
    INBOUND_WEBHOOK_QUEUE_NAME,
    async (job) => {
      const { provider, providerEventId, eventType } = job.data;

      // ── SEAM: domain settlement goes here ───────────────────────────────
      // Re-verify against the provider, then act. For the example money path:
      //
      //   const ctx = resolveCtxFromPayload(job.data.payload);
      //   const reference = job.data.payload.reference as string;
      //   await confirmExampleFromWebhook(db, ctx, {
      //     reference,
      //     providerReference: providerEventId,
      //   });
      //
      // The boilerplate logs + acks so the queue plumbing is provably wired
      // before any real provider is connected.
      logger.info('[worker] inbound-webhook received', {
        jobId: job.id,
        provider,
        providerEventId,
        eventType,
      });

      return { providerEventId, handled: true };
    },
    { connection, concurrency: INBOUND_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] inbound-webhook job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
};
