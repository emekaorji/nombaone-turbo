import { Router } from 'express';

import { buildOpenApiDocument } from '@shared/openapi/build';
import { billingSettingsRouter } from '@modules/billing-settings';
import { couponsRouter } from '@modules/coupons';
import { customerRouter } from '@modules/customers';
import { dunningRouter } from '@modules/dunning';
import { eventsRouter } from '@modules/events';
import { exampleRouter } from '@modules/example';
import { healthRouter } from '@modules/health';
import { invoicesRouter } from '@modules/invoices';
import { mandatesRouter } from '@modules/mandates';
import { metricsRouter } from '@modules/metrics';
import { paymentMethodsRouter } from '@modules/payment-methods';
import { plansRouter } from '@modules/plans';
import { pricesRouter } from '@modules/prices';
import { settingsRouter } from '@modules/settings';
import { settlementsRouter } from '@modules/settlements';
import { subscriptionsRouter } from '@modules/subscriptions';
import { webhooksRouter } from '@modules/webhooks';

/**
 * The single versioned router. The `/v1` prefix is applied at EXACTLY ONE mount
 * point (in the main server `index.ts`), so individual module routers declare
 * bare paths
 * (`/examples`, `/health`) and stay version-agnostic — bumping to `/v2` is a
 * one-line change at the mount, never a sweep across modules.
 */
export const v1Router: Router = Router();

v1Router.use(healthRouter);
v1Router.use(customerRouter);
v1Router.use(plansRouter);
v1Router.use(pricesRouter);
v1Router.use(paymentMethodsRouter);
v1Router.use(mandatesRouter);
v1Router.use(subscriptionsRouter);
v1Router.use(dunningRouter);
v1Router.use(invoicesRouter);
v1Router.use(couponsRouter);
v1Router.use(billingSettingsRouter);
v1Router.use(webhooksRouter);
v1Router.use(eventsRouter);
v1Router.use(settlementsRouter);
v1Router.use(settingsRouter);
v1Router.use(metricsRouter);
v1Router.use(exampleRouter);

// The generated OpenAPI 3.1 document (L ⚠) — public (codegen tools fetch it),
// served RAW (not the platform envelope), paths walked from THIS mounted router so
// the spec cannot drift from what is served. Lazily built + cached on first hit.
let cachedOpenApiDoc: Record<string, unknown> | null = null;
v1Router.get('/openapi.json', (_req, res) => {
  cachedOpenApiDoc ??= buildOpenApiDocument(v1Router);
  res.json(cachedOpenApiDoc);
});
