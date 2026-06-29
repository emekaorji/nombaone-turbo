import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { defaultJobOptions } from './options';

export const EXAMPLE_QUEUE_NAME = 'example';

/**
 * Payload for a generic example job. Replace the shape with your own domain
 * job when you copy this boilerplate.
 */
export interface ExampleJobData {
  /** Stable business identifier for the resource this job acts on. */
  reference: string;
  payload: Record<string, unknown>;
}

export type ExampleJobResult = {
  reference: string;
  processedAt: string;
};

export const exampleQueue = new Queue<ExampleJobData, ExampleJobResult>(
  EXAMPLE_QUEUE_NAME,
  {
    connection,
    defaultJobOptions,
  },
);

export const exampleQueueEvents = new QueueEvents(EXAMPLE_QUEUE_NAME, {
  connection,
});

/**
 * Enqueue an example job idempotently.
 *
 * The `jobId` is set to the resource reference, so enqueueing the same
 * reference twice is a no-op in BullMQ (the existing job is reused). This is
 * the canonical pattern for idempotent producers: jobId = resourceId.
 */
export function enqueueExample(data: ExampleJobData) {
  return exampleQueue.add(EXAMPLE_QUEUE_NAME, data, {
    // jobId = resourceId -> idempotent enqueue: a duplicate reference will not
    // create a second job while the first is still known to the queue.
    jobId: data.reference,
  });
}
