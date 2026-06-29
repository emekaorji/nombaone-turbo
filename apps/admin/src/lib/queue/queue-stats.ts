import 'server-only';

import type { Queue } from 'bullmq';
import {
  exampleQueue,
  inboundWebhookQueue,
  outboundWebhookQueue,
  schedulerQueue,
} from '@nombaone/queue';

/**
 * PARADIGM — TIMEOUT-WRAPPED EXTERNAL READS THAT DEGRADE GRACEFULLY.
 *
 * The Jobs & workers screen reads BullMQ queue depths straight from Redis via
 * `@nombaone/queue`. Locally (and during a Redis outage) there may be no
 * reachable Redis: `getJobCounts()` could then hang on a stalled TCP connect or
 * reject. So the whole read is RACED against a short deadline inside one
 * try/catch, and on ANY failure we return `{ status: 'unavailable' }` — the page
 * renders an "unavailable" state instead of crashing the server render. The
 * queue singletons are created at import (ioredis connects lazily in the
 * background), so importing them is safe; only the round-trip can fail, which is
 * exactly what we guard.
 */

/** The four async flows this stack runs. Display name → BullMQ queue. */
const QUEUES: ReadonlyArray<{ name: string; queue: Queue }> = [
  { name: 'example', queue: exampleQueue as unknown as Queue },
  { name: 'outbound-webhook', queue: outboundWebhookQueue as unknown as Queue },
  { name: 'inbound-webhook', queue: inboundWebhookQueue as unknown as Queue },
  { name: 'scheduler', queue: schedulerQueue as unknown as Queue },
];

/** Short deadline so an unreachable Redis can't hang the server render. */
const QUEUE_READ_TIMEOUT_MS = 2500;

export type QueueDepth = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type QueueStats =
  | { status: 'ok'; queues: QueueDepth[] }
  | { status: 'unavailable' };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error('queue read timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (error) => {
        clearTimeout(handle);
        reject(error);
      }
    );
  });
}

/**
 * Read the platform queue depths, or the `unavailable` state when Redis cannot
 * be reached. Never throws.
 */
export async function readQueueStats(): Promise<QueueStats> {
  try {
    const queues = await withTimeout(
      Promise.all(
        QUEUES.map(async ({ name, queue }) => {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed'
          );
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
          } satisfies QueueDepth;
        })
      ),
      QUEUE_READ_TIMEOUT_MS
    );
    return { status: 'ok', queues };
  } catch {
    return { status: 'unavailable' };
  }
}
