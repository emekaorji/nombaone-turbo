import { selectDueSubscriptionsFair, type FairSweepConfig } from '../scheduling';
import { findDueSubscriptions, type DueCursor } from './queries';

import type { DomainContext, Environment, InfraDb } from '../context';

export interface BillingSweepEnqueueJob {
  subscriptionId: string;
  subscriptionReference: string;
  periodIndex: number;
  organizationId: string;
  environment: Environment;
}

export interface BillingSweepDeps {
  db: InfraDb;
  now: Date;
  batchSize: number;
  /** Infra enqueue, injected so sara stays free of the queue layer (DI). */
  enqueue: (job: BillingSweepEnqueueJob) => Promise<unknown>;
  /**
   * H7 ★: fair, per-tenant-budgeted selection instead of the naive keyset scan. When
   * set, ONE bounded tick draws a fair share per tenant (no tenant starves); 04's
   * catch-up drains backlogs across ticks. Selection only — the claim stays 04's.
   */
  fair?: { environment: Environment; config?: FairSweepConfig };
}

/**
 * The billing sweep TICK (04 D.4/D.8): keyset-batched scan of due subscriptions,
 * fanning out **one bill job per subscription** — it does NOT charge inline, so the
 * tick is O(batches) and returns fast with no long transaction over thousands of
 * rows (B11). Per-subscription claim-once billing happens in the drained worker.
 * Idempotent: re-running enqueues the same `(subscription, period)` jobs, which the
 * queue dedups by jobId (K4).
 */
export async function runBillingSweep(deps: BillingSweepDeps): Promise<{ enqueued: number }> {
  let enqueued = 0;

  // H7 ★: fair mode — one bounded, round-robin tick (04's catch-up drains the rest).
  if (deps.fair) {
    const rows = await selectDueSubscriptionsFair(
      deps.db,
      deps.fair.environment,
      deps.now,
      deps.fair.config
    );
    for (const row of rows) {
      await deps.enqueue({
        subscriptionId: row.id,
        subscriptionReference: row.reference,
        periodIndex: row.currentPeriodIndex,
        organizationId: row.organizationId,
        environment: row.environment,
      });
      enqueued += 1;
    }
    return { enqueued };
  }

  let cursor: DueCursor | undefined;

  for (;;) {
    const { rows, nextCursor } = await findDueSubscriptions(deps.db, {
      now: deps.now,
      cursor,
      limit: deps.batchSize,
    });

    for (const sub of rows) {
      await deps.enqueue({
        subscriptionId: sub.id,
        subscriptionReference: sub.reference,
        periodIndex: sub.currentPeriodIndex,
        organizationId: sub.organizationId,
        environment: sub.environment,
      });
      enqueued += 1;
    }

    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return { enqueued };
}

/** A tenant-scoped helper the worker uses to build the per-job domain context. */
export const jobContext = (organizationId: string, environment: Environment): DomainContext => ({
  organizationId,
  environment,
});
