import { Worker } from 'bullmq';

import { BILLING_QUEUE_NAME, connection } from '@nombaone/queue';
import { runCycle } from '@nombaone/sara/billing';
import { getSubscriptionByReference } from '@nombaone/sara/subscriptions';
import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { db } from '../../../shared/config/db';
import { env } from '../../../shared/config/env';
import { logger } from '../../../shared/observability/logger';

import type { BillingJobData, BillingJobResult } from '@nombaone/queue';
import type { DomainContext } from '@nombaone/sara/context';

/**
 * ── Billing worker (per-subscription renewal) ──────────────────────────────
 *
 * Drains the `billing` fan-out queue. Each job runs the 03 charge loop once for
 * one subscription via `runCycle`, which claims the period (subscription_periods
 * ON CONFLICT) and bills it idempotently (invoices unique + the paid CAS). A
 * STALENESS guard skips a job whose subscription already advanced past the
 * enqueued period — so a redelivered/overlapping job never bills the next period
 * early. jobId = `${subscriptionId}:${periodIndex}`, so BullMQ collapses
 * redeliveries onto one job.
 */
const BILLING_CONCURRENCY = 10;

export const createBillingWorker = (): Worker<BillingJobData, BillingJobResult> => {
  const worker = new Worker<BillingJobData, BillingJobResult>(
    BILLING_QUEUE_NAME,
    async (job) => {
      const { subscriptionId, subscriptionReference, periodIndex, organizationId, environment } =
        job.data;
      const ctx: DomainContext = { organizationId, environment };

      const sub = await getSubscriptionByReference(db, ctx, subscriptionReference);
      if (sub.currentPeriodIndex !== periodIndex) {
        logger.info('[worker] billing job stale; skipping', {
          jobId: job.id,
          subscriptionReference,
          periodIndex,
          current: sub.currentPeriodIndex,
        });
        return { subscriptionId, outcome: 'skipped' };
      }

      try {
        const result = await runCycle(db, ctx, subscriptionReference, {
          maxCatchUpPeriods: env.BILLING_MAX_CATCH_UP_PERIODS,
        });
        logger.info('[worker] billing cycle ran', {
          jobId: job.id,
          subscriptionReference,
          periodIndex,
          outcome: result.outcome,
        });
        return { subscriptionId, outcome: result.outcome };
      } catch (error) {
        // A pathologically stale subscription: alert for manual review instead of
        // crashing the worker / retrying forever.
        if ((error as { code?: string }).code === NOMBAONE_ERROR_CODES.BILLING_CATCH_UP_LIMIT_EXCEEDED) {
          logger.error('[worker] billing catch-up limit exceeded; manual review required', {
            jobId: job.id,
            subscriptionReference,
            periodIndex,
          });
          return { subscriptionId, outcome: 'catch_up_limit_exceeded' };
        }
        throw error;
      }
    },
    { connection, concurrency: BILLING_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] billing job failed', { jobId: job?.id, error: error.message });
  });

  return worker;
};
