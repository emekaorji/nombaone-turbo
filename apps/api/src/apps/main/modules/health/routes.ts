import { Router } from 'express';

import { jsonHandler } from '@shared/http';

/**
 * Liveness probe. No auth, no rate-limit, no scope — a load balancer / k8s probe
 * must be able to hit it cheaply. Returns the success envelope so even health
 * checks share the platform's one response shape.
 *
 * NOTE: the deep READINESS probe (DB / Redis / Nomba-token check) is intentionally
 * NOT part of the public developer API — it belongs to the admin/ops surface. See
 * `workbench/admin-ops.md`.
 */
export const healthRouter: Router = Router();

healthRouter.get(
  '/health',
  jsonHandler(() => ({ data: { status: 'ok' as const } }))
);
