import { Worker } from 'bullmq';

import { INBOUND_WEBHOOK_QUEUE_NAME, connection } from '@nombaone/queue';
import { processInboundInvoiceEvent } from '@nombaone/sara/billing';
import { processInboundNombaEvent } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { getNombaClient } from '@shared/config/nomba';
import { logger } from '@shared/observability/logger';

import type { InboundWebhookJobData, InboundWebhookJobResult } from '@nombaone/queue';

/**
 * ── Inbound webhook processing worker (provider → us, deferred) ────────────
 *
 * The webhook edge fast-acks and enqueues; THIS worker does the durable,
 * retryable processing. For Nomba it resolves the owning tenant from OUR
 * reference in the payload, then settles (idempotently) and durably records the
 * event (`processInboundNombaEvent`): a redelivered/out-of-order event has
 * exactly one effect (capture is a no-op on an already-active method; the
 * `unique(provider, request_id)` row guarantees one event row). jobId = the
 * provider event id, so redeliveries also collapse onto one job.
 *
 * Concurrency is capped: inbound processing hits the DB (+ provider API) per job.
 */
const INBOUND_CONCURRENCY = 5;

export const createInboundWebhookWorker = (): Worker<
  InboundWebhookJobData,
  InboundWebhookJobResult
> => {
  const worker = new Worker<InboundWebhookJobData, InboundWebhookJobResult>(
    INBOUND_WEBHOOK_QUEUE_NAME,
    async (job) => {
      const { provider, providerEventId, eventType, payload } = job.data;

      if (provider === 'nomba') {
        const requestId =
          typeof payload.requestId === 'string' ? payload.requestId : providerEventId;

        // Invoice settlement first: if OUR reference resolves to an invoice, requery
        // + confirm (E4). Otherwise fall through to the payment-method inbound path.
        const invoice = await processInboundInvoiceEvent(db, getNombaClient(), {
          requestId,
          eventType,
          payload,
        });
        if (invoice.matched) {
          logger.info('[worker] nomba inbound settled invoice', {
            jobId: job.id,
            providerEventId,
            eventType,
            settled: invoice.settled,
            firstSeen: invoice.firstSeen,
          });
          return { providerEventId, handled: invoice.handled };
        }

        const result = await processInboundNombaEvent(db, { requestId, eventType, payload });
        logger.info('[worker] nomba inbound processed', {
          jobId: job.id,
          providerEventId,
          eventType,
          outcome: result.outcome,
          firstSeen: result.firstSeen,
        });
        return { providerEventId, handled: result.handled };
      }

      logger.info('[worker] inbound-webhook received (unhandled provider)', {
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
