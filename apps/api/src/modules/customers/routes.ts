import { Router } from 'express';

import {
  createCustomerBody,
  listCustomerQuery,
  updateCustomerBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '../../shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '../../shared/middlewares';
import {
  createCustomerController,
  getCustomerController,
  listCustomerController,
  updateCustomerController,
} from './controllers';

/**
 * The customers resource — the first real product slice. Same fixed per-route
 * stack as every scoped resource:
 *
 *   auth → rate-limit → scope → idempotency → validate → handler
 *
 * Writes (POST/PATCH) carry `idempotency` (Idempotency-Key required) and the
 * `:write` scope; reads only need auth + the `:read` scope. (platformGate is
 * applied app-wide in `app/main/app.ts`, so it is not repeated per route.)
 */
export const customerRouter: Router = Router();

// POST /customers — create (mutating, idempotent, scoped write).
customerRouter.post(
  '/customers',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotency,
  validate({ body: createCustomerBody }),
  createCustomerController
);

// GET /customers/:reference — fetch one (scoped read).
customerRouter.get(
  '/customers/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:read'),
  getCustomerController
);

// GET /customers — list (scoped read, validated query).
customerRouter.get(
  '/customers',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:read'),
  validate({ query: listCustomerQuery }),
  listCustomerController
);

// PATCH /customers/:reference — update mutable fields (mutating, idempotent, scoped write).
customerRouter.patch(
  '/customers/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotency,
  validate({ body: updateCustomerBody }),
  updateCustomerController
);
