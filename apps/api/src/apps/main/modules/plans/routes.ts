import { Router } from 'express';

import {
  createPlanBody,
  createPriceBody,
  listPlanQuery,
  listPriceQuery,
  updatePlanBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  archivePlanController,
  createPlanController,
  createPlanPriceController,
  getPlanController,
  listPlanPricesController,
  listPlansController,
  updatePlanController,
} from './controllers';

/**
 * The catalog: plans + the immutable prices nested under them. Same fixed
 * per-route stack as every scoped resource (auth → rate-limit → scope →
 * idempotencyOptional → validate → handler); reads skip idempotencyOptional. A plan is retired by
 * the explicit `…/archive` action — there is intentionally **no DELETE route**
 * (O1: a plan with subscribers must not be orphaned).
 */
export const plansRouter: Router = Router();

// ── plans CRUD ──────────────────────────────────────────────────────────────
plansRouter.post(
  '/plans',
  apiKeyAuth,
  rateLimit,
  requireScope('plans:write'),
  idempotencyOptional,
  validate({ body: createPlanBody }),
  createPlanController
);
plansRouter.get('/plans/:id', apiKeyAuth, rateLimit, requireScope('plans:read'), getPlanController);
plansRouter.get(
  '/plans',
  apiKeyAuth,
  rateLimit,
  requireScope('plans:read'),
  validate({ query: listPlanQuery }),
  listPlansController
);
plansRouter.patch(
  '/plans/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('plans:write'),
  idempotencyOptional,
  validate({ body: updatePlanBody }),
  updatePlanController
);

// ── plan lifecycle (archive, never delete) ───────────────────────────────────
plansRouter.post(
  '/plans/:id/archive',
  apiKeyAuth,
  rateLimit,
  requireScope('plans:write'),
  idempotencyOptional,
  archivePlanController
);

// ── prices under a plan (create = new version; list) ─────────────────────────
plansRouter.post(
  '/plans/:id/prices',
  apiKeyAuth,
  rateLimit,
  requireScope('prices:write'),
  idempotencyOptional,
  validate({ body: createPriceBody }),
  createPlanPriceController
);
plansRouter.get(
  '/plans/:id/prices',
  apiKeyAuth,
  rateLimit,
  requireScope('prices:read'),
  validate({ query: listPriceQuery }),
  listPlanPricesController
);
