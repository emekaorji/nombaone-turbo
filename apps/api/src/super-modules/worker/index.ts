import { logger } from '../../shared/observability/logger';
import { createInboundWebhookWorker } from './workers/inbound-webhook';
import { createOutboundWebhookWorker } from './workers/outbound-webhook';

import type { Worker } from 'bullmq';

/**
 * ── The worker SUPERVISOR ──────────────────────────────────────────────────
 *
 * One place that owns the lifecycle of every BullMQ Worker in this process:
 * `startWorkers()` constructs and registers them, `stopWorkers()` closes them
 * gracefully (let in-flight jobs finish, stop pulling new ones). The server's
 * graceful-shutdown path calls `stopWorkers()` so a SIGTERM drains cleanly
 * instead of dropping a job mid-flight.
 *
 * Workers can run in-process with the API (single deployable) or be split into a
 * dedicated worker process later — this supervisor is the seam either way.
 */

let workers: Worker[] = [];

export const startWorkers = (): void => {
  if (workers.length > 0) {
    logger.warn('[worker] startWorkers called while workers already running; ignoring');
    return;
  }
  workers = [createOutboundWebhookWorker(), createInboundWebhookWorker()];
  logger.info(`[worker] started ${workers.length} workers`);
};

export const stopWorkers = async (): Promise<void> => {
  if (workers.length === 0) return;
  // `worker.close()` stops fetching new jobs and waits for in-flight ones.
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
  logger.info('[worker] all workers closed');
};
