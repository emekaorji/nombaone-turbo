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

/**
 * 🔴 STALE-JOB CEILING. A customer email that has been sitting in the queue for half a day
 * is not worth sending — it is worth NOT sending.
 *
 * "Your subscription renews in 1 minute" delivered twelve hours late is not a reminder, it
 * is a lie; a dunning warning for an invoice that has since been paid is worse than
 * silence. And the operational failure mode is real: a months-old backlog of jobs sat in
 * Redis, and the instant the transport was pointed at a live mail vendor it fired ~200 of
 * them at once — exhausting the daily quota and aiming a burst of hard bounces at a fresh
 * sending domain.
 *
 * 12 hours is deliberately generous: it is far longer than any legitimate retry ladder (a
 * mail-vendor outage recovers well inside it), so this drops backlogs without ever dropping
 * a dunning email that was merely being retried.
 */
const MAX_JOB_AGE_MS = 12 * 60 * 60 * 1000;

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
          // Stale ⇒ drop. Completing the job (rather than throwing) is the point: a throw
          // would retry it, and retrying is exactly the harm.
          const ageMs = Date.now() - job.timestamp;
          if (ageMs > MAX_JOB_AGE_MS) {
            logger.warn('[worker] comms job DROPPED — too old to be true', {
              jobId: job.id,
              template: job.data.template,
              ageHours: Math.round(ageMs / 3_600_000),
            });
            return { delivered: false };
          }

          const message = renderMail(job.data);
          const transport = getMailTransport();
          const result = await transport.send(message);

          // The transport refused an address that cannot exist (a reserved `.test` domain).
          // Not a failure — a deliberate skip. Never retry it: retrying a guaranteed hard
          // bounce is how a sending domain gets suspended.
          if (result.skipped) {
            logger.warn('[worker] comms SKIPPED — undeliverable address', {
              jobId: job.id,
              template: job.data.template,
              reason: result.skipped,
            });
            return { delivered: false };
          }

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
    {
      connection,
      concurrency: COMMS_CONCURRENCY,
      /**
       * 🔴 RATE LIMIT — Resend hard-caps at 10 requests/second and answers 429 above it.
       *
       * Without this the worker drains the queue as fast as it can and Resend simply
       * refuses the overflow. Observed live: a backlog produced 62 × 429 in one burst. On
       * a real dunning run that is dropped payment warnings — the customer never learns
       * their card failed, and they churn silently. BullMQ retries with backoff, but a
       * self-inflicted 429 storm is not something to recover from; it is something not to
       * cause.
       *
       * 8/sec leaves headroom under the 10/sec ceiling for the console's own mail (team
       * invites, password resets), which shares the same Resend account and is NOT behind
       * this queue.
       */
      limiter: { max: 8, duration: 1000 },
    }
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
