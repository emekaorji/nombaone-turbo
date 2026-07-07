// eslint-disable-next-line import/order -- env must load before any @nombaone/* import so transitive process.env reads see the loaded .env
import { env } from './shared/config/env';

import { createServer as createHttpServer } from 'node:http';

import { createMainApp } from './apps/main/server';
import { logger } from './shared/observability/logger';

/**
 * ── HTTP-only boot (no workers, no scheduler) ──────────────────────────────
 *
 * Mounts ONLY the public `/v1` API (createMainApp) and listens. It deliberately
 * does NOT start the BullMQ workers or the cron scheduler, so there are no
 * timer-driven billing/dunning/reconcile sweeps — every money write happens only
 * when a request explicitly triggers it. Redis is still required (the rate-limit
 * + idempotency middleware use the shared client), but no background jobs run.
 *
 * Used by the first-party console bridge for on-demand, user-initiated writes.
 * For the full engine (background sweeps, webhook delivery), run `server.ts`.
 */
const app = createMainApp();
const server = createHttpServer(app);

server.listen(env.PORT, () => {
  logger.info(`[api:http-only] listening on :${env.PORT} — /v1 only, no workers/scheduler`);
});

const shutdown = (signal: string): void => {
  logger.info(`[api:http-only] ${signal} received — closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
