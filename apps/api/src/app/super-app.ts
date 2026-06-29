import express, { type Express } from 'express';

import { createMainApp } from './main/app';
import { createWebhookApp } from './webhook/app';

/**
 * ── The composed super-app ─────────────────────────────────────────────────
 *
 * One Express host that mounts both apps behind a single port:
 *
 *   • `/webhooks/*` → the inbound webhook sub-app (raw-body parser, signature
 *     auth, fast-ack). Mounted FIRST so its raw-body `json()` owns those paths
 *     and the main app's standard `json()` never touches them.
 *   • everything else → the public API (`/v1/...`).
 *
 * Each sub-app keeps its own middleware pipeline and error handler, so this is
 * pure composition. When the webhook ingest needs to scale independently, lift
 * `createWebhookApp()` onto its own server and drop the mount here — nothing in
 * either app changes.
 */
export const createSuperApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');

  app.use('/webhooks', createWebhookApp());
  app.use(createMainApp());

  return app;
};
