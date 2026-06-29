import cookieParser from 'cookie-parser';
import express, { type Express, json } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from '../../shared/config/env';
import { errorHandler, notFoundHandler, requestId } from '../../shared/http';
import { platformGate } from '../../shared/middlewares';
import { v1Router } from './routes';

/**
 * ── The MAIN public-API app (merchant → us) ────────────────────────────────
 *
 * This is the JSON REST surface authenticated by API keys. It is assembled, not
 * started: `createServer` (server.ts) composes it with the webhook sub-app and
 * owns the listener, so this module stays import-safe for tests.
 *
 * Pipeline order matters:
 *   helmet → cookieParser → json → morgan → requestId → platformGate → /v1
 *   → notFound → errorHandler
 *
 *   • helmet first         — security headers on everything, including errors.
 *   • json before routes   — parse the body the validators/controllers read.
 *   • requestId before /v1 — every response (success or error) echoes the id.
 *   • platformGate before /v1 — a maintenance pause covers every mutating path
 *     uniformly, ahead of any per-route auth work.
 *   • notFound then error  — a 404 falls through to the JSON not-found shape;
 *     the error handler is LAST so it catches everything above it.
 */
export const createMainApp = (): Express => {
  const app = express();

  // Trust the proxy so `req.ip` / protocol reflect the real client behind a LB.
  app.set('trust proxy', true);
  // Don't advertise Express.
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  app.use(json());

  // HTTP access log, tagged for the platform; silent under test to keep output
  // clean and deterministic.
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('[api] :method :url :status :response-time ms'));
  }

  app.use(requestId);
  app.use(platformGate);

  // The version prefix is applied at exactly ONE place.
  app.use('/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
