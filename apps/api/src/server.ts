// eslint-disable-next-line import/order -- env must load before any @nombaone/* import so transitive process.env reads (e.g. @nombaone/queue redis url) see the loaded .env
import { env } from './shared/config/env';

import express, { type Express } from 'express';
import { createServer as createHttpServer, type Server } from 'node:http';

import { connection as queueConnection } from '@nombaone/queue';

import { pool } from './shared/config/db';
import { registerRailsIfConfigured } from './shared/config/nomba';
import { registerWebhookDispatch } from './shared/webhooks/dispatch';
import { getMailTransport } from './shared/services/comms';
import { redis } from './shared/config/redis';
import { logger } from './shared/observability/logger';
import { initializeScheduler } from './services/cron';
import { startWorkers, stopWorkers } from './services/worker';
import { createMainApp } from './apps/main/server';
import { createWebhookApp } from './apps/webhook/server';

/**
 * ── The process entrypoint ─────────────────────────────────────────────────
 *
 * One Express host that mounts both apps behind a single port, starts the
 * in-process workers + scheduler, and listens on `env.PORT`:
 *
 *   • `/webhooks/*` → the inbound webhook sub-app (raw-body parser, signature
 *     auth, fast-ack). Mounted FIRST so its raw-body `json()` owns those paths
 *     and the main app's standard `json()` never touches them.
 *   • everything else → the public API (`/v1/...`).
 *
 * Each sub-app keeps its own middleware pipeline and error handler, so the mount
 * is pure composition. When the webhook ingest needs to scale independently,
 * lift `createWebhookApp()` onto its own server and drop the mount here.
 *
 * On a shutdown signal it drains GRACEFULLY in dependency order:
 *
 *   1. stop accepting new HTTP connections (`server.close`) — in-flight requests
 *      finish, new ones are refused at the socket.
 *   2. close the workers + scheduler — let in-flight jobs complete, stop pulling.
 *   3. close the infra clients — the DB pool, the shared Redis, and the queue's
 *      own Redis connection.
 *
 * Shutdown is guarded so a second signal during drain does not double-run it, and
 * a hung drain is force-exited after a timeout so the orchestrator is never left
 * waiting forever.
 */

/** Hard cap on graceful drain before we force the process down. */
const SHUTDOWN_TIMEOUT_MS = 15_000;

/**
 * Compose the two Express apps into a single host. The webhook sub-app is
 * mounted at `/webhooks` FIRST so its raw-body parser owns those paths.
 */
const createSuperApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');

  app.use('/webhooks', createWebhookApp());
  app.use(createMainApp());

  return app;
};

export const createServer = (): Server => createHttpServer(createSuperApp());

const start = (): void => {
  // ── 🔴 WIRE THE MONEY. This must happen BEFORE anything can serve a request or
  // run a sweep.
  //
  // `registerRailsIfConfigured()` is what swaps the mock rails (registered by an
  // import side-effect in `@nombaone/sara/rails`) for the REAL Nomba card / mandate /
  // transfer adapters, and installs the Nomba client factory that
  // `mintInvoiceCheckoutLink` needs.
  //
  // It existed, and was correct, and was called from NOWHERE — its only caller in the
  // entire repo was a single e2e test. So the deployed API booted with only `mock_pull`
  // and `mock_push` registered, which meant, in production:
  //   • `getRail('card')` threw `RAIL_NOT_REGISTERED` on every renewal charge;
  //   • `getBillingNombaClient()` returned null, so `mintInvoiceCheckoutLink` returned
  //     null and `POST /v1/subscriptions` handed the customer NO checkout link at all.
  // The money path only ever worked under test, where the harness injects a client.
  // Nothing else in this service matters if this line is missing.
  const railsRegistered = registerRailsIfConfigured();
  if (railsRegistered) {
    logger.info('[api] Nomba rails registered (card, mandate, transfer)');
  } else {
    // Not fatal — a dev box with no creds should still boot and serve reads. But this is
    // the difference between an API that can take money and one that cannot, so it must
    // never be something you have to go looking for.
    logger.error(
      '[api] NO NOMBA CREDENTIALS — the mock rails are live. No charge, checkout link, or payout can work.'
    );
  }

  // The other half of the same omission: `emitEvent` wrote the delivery rows and nothing
  // ever posted them, so outbound webhooks were only sent by the maintenance cron — up to
  // a full cron interval after the event. This gives the outbox its postman.
  registerWebhookDispatch();
  logger.info('[api] outbound webhook dispatch registered');

  const server = createServer();

  server.listen(env.PORT, () => {
    logger.info(`[api] running on ${env.PORT}`);
  });

  // Start background processing in-process alongside the HTTP server. The worker
  // supervisor owns every Worker (including the cron worker that drains the
  // scheduler queue); the scheduler module only registers the repeatables.
  startWorkers();
  void initializeScheduler();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[api] ${signal} received; shutting down gracefully`);

    const forceExit = setTimeout(() => {
      logger.error('[api] graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      // 1. Stop accepting new connections; wait for in-flight requests.
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });

      // 2. Drain background work (the cron worker that runs scheduled sweeps is
      //    one of these workers, so this also stops the scheduler execution).
      await stopWorkers();

      // 3. Close infra clients. The SMTP transport pools a TLS socket, which keeps the
      //    event loop alive — without closing it the process never exits on SIGTERM and
      //    the orchestrator SIGKILLs it, potentially mid-send.
      await getMailTransport().close?.();
      await pool.end();
      queueConnection.disconnect();
      redis.disconnect();

      clearTimeout(forceExit);
      logger.info('[api] shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('[api] error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

start();
