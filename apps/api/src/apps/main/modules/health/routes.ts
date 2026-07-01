import { sql } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@shared/config/db';
import { getNombaClient, isNombaConfigured } from '@shared/config/nomba';
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
 * `PING`, and — when Nomba is configured for this deployment — that a Nomba access
 * token is obtainable). The Nomba check is cheap: `getToken()` reads the cached
 * token and only refreshes near expiry. When Nomba is not configured (e.g. the
 * catalog-only surfaces, or tests) it is reported `skipped` and does not block
 * readiness. Returns `200` only when all non-skipped deps are green; `503` + a
 * per-dependency status map otherwise. Unauthenticated (probes must hit it cheaply).
 */
healthRouter.get(
  '/ready',
  jsonHandler(async () => {
    const deps: Record<string, 'ok' | 'down' | 'skipped'> = {
      db: 'down',
      redis: 'down',
      nomba: 'skipped',
    };
    const checks: Promise<unknown>[] = [
      db
        .execute(sql`select 1`)
        .then(() => {
          deps.db = 'ok';
        })
        .catch(() => {
          deps.db = 'down';
        }),
      redis
        .ping()
        .then(() => {
          deps.redis = 'ok';
        })
        .catch(() => {
          deps.redis = 'down';
        }),
    ];
    if (isNombaConfigured()) {
      deps.nomba = 'down';
      checks.push(
        getNombaClient()
          .getToken()
          .then(() => {
            deps.nomba = 'ok';
          })
          .catch(() => {
            deps.nomba = 'down';
          })
      );
    }
    await Promise.all(checks);
    const ready = Object.values(deps).every((s) => s === 'ok' || s === 'skipped');
    return { data: { ready, dependencies: deps }, statusCode: ready ? 200 : 503 };
  })
);
