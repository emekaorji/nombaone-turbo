import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { env } from '../config/env';
import { redis } from '../config/redis';
import { logger } from '../observability/logger';

import type { RequestHandler } from 'express';

/**
 * ── rateLimit — per-API-key fixed-window throttle ──────────────────────────
 *
 * A fixed-window counter in Redis, keyed per authenticated API key. The first
 * request in a window does `INCR` then `EXPIRE`; subsequent requests just `INCR`.
 * Once the count exceeds the cap we reject with 429 RATE_LIMIT_EXCEEDED and a
 * `Retry-After` header (seconds until the window rolls over).
 *
 * Fixed-window (not sliding) is deliberate: one INCR + one conditional EXPIRE is
 * a single round-trip on the hot path with no Lua, no sorted sets, no clock
 * skew. The burst-at-boundary imprecision is acceptable for coarse abuse
 * protection; precise quota accounting is a billing concern, out of scope here.
 *
 * FAIL-OPEN: a Redis error never blocks a request — an outage of the limiter
 * must not become an outage of the API. Skipped entirely when
 * `env.DISABLE_API_RATE_LIMIT` (local-only escape hatch).
 *
 * Headers emitted on every limited request: `X-RateLimit-Limit`,
 * `X-RateLimit-Remaining`, plus `Retry-After` on rejection.
 */

/** Requests allowed per window, per key. */
const WINDOW_LIMIT = 120;
/** Window length in seconds. */
const WINDOW_SECONDS = 60;

export const rateLimit: RequestHandler = async (req, res, next) => {
  if (env.DISABLE_API_RATE_LIMIT) {
    next();
    return;
  }

  // Without an authenticated key there is nothing to throttle on; auth runs
  // first in the chain, so this is just defence in depth.
  if (!req.apiKey) {
    next();
    return;
  }

  const redisKey = `ratelimit:${req.apiKey.apiKeyId}:${Math.floor(Date.now() / 1000 / WINDOW_SECONDS)}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window — set the expiry so the counter self-resets.
      await redis.expire(redisKey, WINDOW_SECONDS);
    }

    const remaining = Math.max(0, WINDOW_LIMIT - count);
    res.setHeader('X-RateLimit-Limit', String(WINDOW_LIMIT));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (count > WINDOW_LIMIT) {
      // Seconds until the current fixed window rolls over.
      const ttl = await redis.ttl(redisKey);
      const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS;
      res.setHeader('Retry-After', String(retryAfter));
      throw AppError.TooManyRequests(
        'Rate limit exceeded',
        { limit: WINDOW_LIMIT, windowSeconds: WINDOW_SECONDS, retryAfter },
        NOMBAONE_ERROR_CODES.RATE_LIMIT_EXCEEDED
      );
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    // FAIL-OPEN: limiter store unavailable → let the request through.
    logger.warn(`[api] ${req.requestId} rate-limit store unavailable; failing open`, {
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};
