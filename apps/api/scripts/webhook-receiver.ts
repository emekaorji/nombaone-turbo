/* eslint-disable import/order */
// RECEIVER-ONLY server for the live webhook byte-confirm. Mounts ONLY the inbound
// webhook edge (createWebhookApp) — NO billing workers, NO scheduler — so the live
// billing engine cannot auto-charge anything. The edge logs the raw body + all
// signature candidates (NOMBA_WEBHOOK_DEBUG=true) before touching Redis/DB.
//   npx tsx scripts/webhook-receiver.ts
import { env } from '../src/shared/config/env'; // loads .env first
import express from 'express';
import { createServer } from 'node:http';
import { createWebhookApp } from '../src/apps/webhook/server';

const app = express();
app.disable('x-powered-by');
// Catch-all access log — logs EVERY inbound request (any path/method) so a webhook
// posted to a WRONG path (which the webhook sub-app would silently 404) is still visible.
app.use((req, _res, next) => {
  console.log(
    `[recv] ${req.method} ${req.originalUrl} ct="${req.headers['content-type'] ?? ''}" sig=${
      req.headers['nomba-signature'] ? 'YES' : 'no'
    } ua="${req.headers['user-agent'] ?? ''}"`
  );
  next();
});
app.use('/webhooks', createWebhookApp());
createServer(app).listen(env.PORT, () => {
  console.log(
    `[receiver] webhook-only on ${env.PORT} — NO workers/scheduler; debug=${env.NOMBA_WEBHOOK_DEBUG}; base=${env.NOMBA_BASE_URL}`
  );
});
