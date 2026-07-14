import { Worker } from 'bullmq';

import { BILLING_QUEUE_NAME, connection } from '@nombaone/queue';

import { runCycle } from '@shared/services/billing';
import { getSubscriptionByReference } from '@shared/services/subscriptions';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { runWithCorrelation } from '@shared/observability/correlation';
import { logger } from '@shared/observability/logger';
import { recordChargeFailure } from '@shared/observability/prometheus';

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
      const { subscriptionId, subscriptionReference, periodIndex, organizationId, mode } =
        job.data;
      const ctx: DomainContext = { organizationId, mode };

      return runWithCorrelation(
        {
          correlationId: job.id ?? `billing:${subscriptionId}:${periodIndex}`,
          organizationId,
          mode,
          task: 'billing',
        },
        async () => {
          const sub = await getSubscriptionByReference(db, ctx, subscriptionReference);
          if (sub.currentPeriodIndex !== periodIndex) {
            logger.info('[worker] billing job stale; skipping', {
              jobId: job.id,
              subscriptionReference,
              periodIndex,
              current: sub.currentPeriodIndex,
            });
            return { subscriptionId, outcome: 'skipped' as const };
          }

          // DRAIN the backlog. `runCycle` bills exactly one period, so a subscription that
          // fell behind (a worker outage, a deploy, a laptop shut overnight on a `minute`
          // cadence) needs to be run repeatedly. `BILLING_MAX_CATCH_UP_PERIODS` is the cap on
          // how much ONE job drains — a rate limit, not a wall: whatever is left is still due,
          // so the next sweep tick picks it straight back up. That is the whole point. The old
          // code raised BILLING_CATCH_UP_LIMIT_EXCEEDED and returned WITHOUT advancing, so
          // `next_billing_at` never moved and the row was parked forever.
          let outcome: Awaited<ReturnType<typeof runCycle>>['outcome'] = 'open';
          let billed = 0;

          for (;;) {
            const result = await runCycle(db, ctx, subscriptionReference);
            billed += 1;
            outcome = result.outcome;

            // Dunning owns a failed collection from here; do not keep billing new periods
            // on top of it (a `past_due` sub is excluded from the sweep anyway).
            if (result.outcome === 'past_due') {
              recordChargeFailure('past_due');
              break;
            }
            // Cancel-at-period-end tripped: nothing was billed and the row is done.
            if (result.outcome === 'canceled') break;

            // Awaiting the payer (hosted-checkout / tokenless sub): the period does
            // NOT advance until money arrives, so looping would re-return the same
            // open invoice `BILLING_MAX_CATCH_UP_PERIODS` times per tick for nothing.
            if (result.outcome === 'awaiting_payment') break;

            // `periodsBehind` was measured BEFORE this run. `0` means the period we just
            // billed is the one currently in flight — we are caught up, and
            // `next_billing_at` now points at its end, in the future. Anything above 0 is
            // real backlog: whole periods that elapsed unbilled. (Stopping at 1 would stop
            // one period short and leave the row due in the PAST — billing is in advance.)
            if (result.periodsBehind === 0) break;

            if (billed >= env.BILLING_MAX_CATCH_UP_PERIODS) {
              logger.warn('[worker] billing backlog not fully drained; next sweep continues', {
                jobId: job.id,
                subscriptionReference,
                billedThisRun: billed,
                periodsStillBehind: result.periodsBehind,
              });
              break;
            }
          }

          if (billed > 1) {
            logger.warn('[worker] billing drained a backlog', {
              jobId: job.id,
              subscriptionReference,
              periodIndex,
              periodsBilled: billed,
            });
          } else {
            logger.info('[worker] billing cycle ran', {
              jobId: job.id,
              subscriptionReference,
              periodIndex,
              outcome,
            });
          }

          return { subscriptionId, outcome };
        }
      );
    },
    { connection, concurrency: BILLING_CONCURRENCY }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] billing job failed', { jobId: job?.id, error: error.message });
  });

  return worker;
};
