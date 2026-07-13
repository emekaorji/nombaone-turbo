import { Worker } from 'bullmq';

import { COMMS_QUEUE_NAME, connection } from '@nombaone/queue';

import { getMailTransport, renderMail } from '@shared/services/comms';
import { runWithCorrelation } from '@shared/observability/correlation';
import { logger } from '@shared/observability/logger';

import type { CommsJobData, CommsJobResult } from '@nombaone/queue';

/**
 * ── Comms worker (end-customer email) ───────────────────────────────────────
 *
 * Drains the `comms` queue: render the template from the job's already-resolved
 * payload, hand it to the transport. A transport failure THROWS so BullMQ
 * retries with backoff — a mail-vendor blip must not eat a dunning warning —
 * while the enqueue side (`enqueueCustomerEmail`) is fire-and-forget so mail can
 * never fail a charge. jobId dedupes per intent (template + dedupe key), so a
 * re-running sweep never re-mails a customer.
 */
const COMMS_CONCURRENCY = 5;

export const createCommsWorker = (): Worker<CommsJobData, CommsJobResult> => {
  const worker = new Worker<CommsJobData, CommsJobResult>(
    COMMS_QUEUE_NAME,
    async (job) => {
      return runWithCorrelation(
        {
          correlationId: job.id ?? `comms:${job.data.template}`,
          organizationId: job.data.organizationId,
          mode: job.data.mode,
        },
        async () => {
          const message = renderMail(job.data);
          const transport = getMailTransport();
          const result = await transport.send(message);
          logger.info('[worker] comms sent', {
            jobId: job.id,
            template: job.data.template,
            transport: transport.kind,
            delivered: result.delivered,
          });
          return { delivered: result.delivered };
        }
      );
    },
    { connection, concurrency: COMMS_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.warn('[worker] comms job failed (will retry per backoff)', {
      jobId: job?.id,
      template: job?.data.template,
      error: error.message,
    });
  });

  return worker;
};
