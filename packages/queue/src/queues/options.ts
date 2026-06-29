import type { DefaultJobOptions } from 'bullmq';

/**
 * Standard job options shared by every queue in this package.
 *
 * - `attempts` is capped so a poisoned job can never retry forever.
 * - `backoff` is exponential, so retries spread out instead of hammering
 *   downstream services.
 * - `removeOnComplete` / `removeOnFail` are bounded by BOTH count and age so
 *   Redis memory stays flat: jobs are evicted once they exceed the count or
 *   the age window, whichever comes first.
 */
export const ONE_HOUR_SECONDS = 60 * 60;
export const ONE_DAY_SECONDS = 24 * ONE_HOUR_SECONDS;
export const ONE_WEEK_SECONDS = 7 * ONE_DAY_SECONDS;

export const defaultJobOptions: DefaultJobOptions = {
  // Cap retries: 5 attempts total (1 initial + 4 retries).
  attempts: 5,
  backoff: {
    type: 'exponential',
    // 1s, 2s, 4s, 8s ... between attempts.
    delay: 1_000,
  },
  // Keep the last 1,000 completed jobs, and drop anything older than 24h.
  removeOnComplete: {
    count: 1_000,
    age: ONE_DAY_SECONDS,
  },
  // Keep more failures for debugging, retained for a week.
  removeOnFail: {
    count: 5_000,
    age: ONE_WEEK_SECONDS,
  },
};

/**
 * Webhook delivery is latency-sensitive and retried aggressively, so it gets a
 * higher attempt cap with a longer ceiling between tries.
 */
export const webhookJobOptions: DefaultJobOptions = {
  ...defaultJobOptions,
  attempts: 8,
  backoff: {
    type: 'exponential',
    delay: 2_000,
  },
};
