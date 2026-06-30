import { Router } from 'express';

import { customerRouter } from '../../modules/customers';
import { exampleRouter } from '../../modules/example';
import { healthRouter } from '../../modules/health';
import { mandatesRouter } from '../../modules/mandates';
import { paymentMethodsRouter } from '../../modules/payment-methods';
import { plansRouter } from '../../modules/plans';
import { pricesRouter } from '../../modules/prices';

/**
 * The single versioned router. The `/v1` prefix is applied at EXACTLY ONE mount
 * point (in `app.ts`), so individual module routers declare bare paths
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
v1Router.use(exampleRouter);
