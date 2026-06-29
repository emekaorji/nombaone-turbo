import express, { type Express, json } from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler, requestId } from '../../shared/http';
import { webhookRouter } from './routes';

/**
 * ── The INBOUND webhook sub-app (provider → us) ────────────────────────────
 *
 * A SEPARATE Express app from the public API on purpose:
 *
 *   • Its body parser captures the RAW bytes (`verify` → `req.rawBody`) so HMAC
 *     verification runs against exactly what the provider signed. The main API
 *     does not need raw bytes, so keeping this concern isolated avoids buffering
 *     every public request.
 *   • It has NO api-key auth / rate-limit / idempotency stack — providers
 *     authenticate by signature, not by our keys, and BullMQ's jobId dedups
 *     redeliveries.
 *   • It owns its OWN error handler, so a webhook failure is rendered in the
 *     same envelope but isolated from the public API's pipeline.
 *
 * Because it is self-contained it is trivially LIFTABLE to a standalone ingest
 * service later (its own host/port/scaling) without touching the public API.
 */
export const createWebhookApp = (): Express => {
  const app = express();

  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(helmet());

  // Capture the raw body for signature verification. `verify` runs during
  // parsing with the exact bytes, before they are JSON-decoded.
  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    })
  );

  app.use(requestId);

  app.use(webhookRouter);

  app.use(notFoundHandler);
  // The sub-app's OWN error handler — same envelope, isolated pipeline.
  app.use(errorHandler);

  return app;
};
