import { Redis } from 'ioredis';

import { env } from './env';

/** Single shared ioredis client for idempotency + rate-limit. BullMQ owns its
 * own connection in @nombaone/queue. */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
