import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { resolveQuota, resolveRateLimit } from '@shared/services/tenant-config';

import { db } from '../config/db';
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

/** Window length in seconds. */
const WINDOW_SECONDS = 60;
/** How long the resolved per-tenant config is cached in Redis (short — settings are cold). */
const CONFIG_TTL_SECONDS = 60;

interface LimiterConfig {
  perMinute: number;
  monthlyQuota: number | null;
}

/**
 * Resolve a tenant's cap + monthly quota, cached in Redis so the hot path stays
 * cheap (one GET; a cold miss does one DB read). The per-minute WINDOW is keyed per
 * API key, but the CAP + QUOTA are per org so a tenant's keys share one budget (H6).
 */
async function resolveLimiterConfig(
  organizationId: string,
  mode: 'sandbox' | 'live'
): Promise<LimiterConfig> {
  const cacheKey = `ratelimit:cfg:${organizationId}:${mode}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as LimiterConfig;
  const ctx = { organizationId, mode };
  const [{ perMinute }, { monthly }] = await Promise.all([
    resolveRateLimit(db, ctx),
    resolveQuota(db, ctx),
  ]);
  const cfg: LimiterConfig = { perMinute, monthlyQuota: monthly };
  await redis.set(cacheKey, JSON.stringify(cfg), 'EX', CONFIG_TTL_SECONDS);
  return cfg;
}

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

  const { organizationId, mode } = req.apiKey;
  const redisKey = `ratelimit:${req.apiKey.apiKeyId}:${Math.floor(Date.now() / 1000 / WINDOW_SECONDS)}`;

  try {
    const cfg = await resolveLimiterConfig(organizationId, mode);

    // Monthly quota (per org) — coarse, Redis-authoritative in-window. `null` ⇒ off.
    if (cfg.monthlyQuota != null) {
      const now = new Date();
      const period = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const quotaKey = `quota:${organizationId}:${mode}:${period}`;
      const used = await redis.incr(quotaKey);
      if (used === 1) await redis.expire(quotaKey, 40 * 24 * 3600); // > one month
      if (used > cfg.monthlyQuota) {
        throw AppError.TooManyRequests(
          'Monthly request quota exceeded',
          { quota: cfg.monthlyQuota, period },
          NOMBAONE_ERROR_CODES.QUOTA_EXCEEDED
        );
      }
    }

    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window — set the expiry so the counter self-resets.
      await redis.expire(redisKey, WINDOW_SECONDS);
    }

    const remaining = Math.max(0, cfg.perMinute - count);
    res.setHeader('X-RateLimit-Limit', String(cfg.perMinute));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (count > cfg.perMinute) {
      // Seconds until the current fixed window rolls over.
      const ttl = await redis.ttl(redisKey);
      const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS;
      res.setHeader('Retry-After', String(retryAfter));
      throw AppError.TooManyRequests(
        'Rate limit exceeded',
        { limit: cfg.perMinute, windowSeconds: WINDOW_SECONDS, retryAfter },
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
