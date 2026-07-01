import { Router } from 'express';

import { createExampleBody, listExampleQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import {
  apiKeyAuth,
  idempotency,
  rateLimit,
  requireScope,
} from '@shared/middlewares';

import { createExampleController } from './controllers/create';
import { getExampleController } from './controllers/get';
import { listExampleController } from './controllers/list';

/**
 * The example resource — the worked reference for wiring a scoped resource with
 * the FULL per-route stack in its fixed order:
 *
 *   auth → rate-limit → scope → idempotency → validate → handler
 *
 * Writes carry `idempotency` (Idempotency-Key required) and the `:write` scope;
 * reads only need auth + the `:read` scope. (platformGate is applied app-wide in
 * `app/main/app.ts`, so it is not repeated per route.)
 */
export const exampleRouter: Router = Router();

// POST /examples — create (mutating, idempotent, scoped write).
exampleRouter.post(
  '/examples',
  apiKeyAuth,
  rateLimit,
  requireScope('example:write'),
  idempotency,
  validate({ body: createExampleBody }),
  createExampleController
);

// GET /examples/:reference — fetch one (scoped read).
exampleRouter.get(
  '/examples/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('example:read'),
  getExampleController
);

// GET /examples — list (scoped read, validated query).
exampleRouter.get(
  '/examples',
  apiKeyAuth,
  rateLimit,
  requireScope('example:read'),
  validate({ query: listExampleQuery }),
  listExampleController
);
