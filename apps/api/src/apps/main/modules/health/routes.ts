import { sql } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@shared/config/db';
import { redis } from '@shared/config/redis';
import { jsonHandler } from '@shared/http';

/**
 * Liveness probe. No auth, no rate-limit, no scope — a load balancer / k8s probe
 * must be able to hit it cheaply. Returns the success envelope so even health
 * checks share the platform's one response shape.
 */
export const healthRouter: Router = Router();

healthRouter.get(
  '/health',
  jsonHandler(() => ({ data: { status: 'ok' as const } }))
);

/**
 * Readiness probe (M) — deep-checks the real dependencies (DB `select 1`, Redis
 * `PING`). Returns `200` only when all green; `503` + a per-dependency status map
 * otherwise. Unauthenticated (probes must hit it cheaply).
 */
healthRouter.get(
  '/ready',
  jsonHandler(async () => {
    const deps: Record<string, 'ok' | 'down'> = { db: 'down', redis: 'down' };
    await Promise.all([
      db.execute(sql`select 1`).then(() => { deps.db = 'ok'; }).catch(() => { deps.db = 'down'; }),
      redis.ping().then(() => { deps.redis = 'ok'; }).catch(() => { deps.redis = 'down'; }),
    ]);
    const ready = Object.values(deps).every((s) => s === 'ok');
    return { data: { ready, dependencies: deps }, statusCode: ready ? 200 : 503 };
  })
);
