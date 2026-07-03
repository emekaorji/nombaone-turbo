import { Router } from 'express';

import {
  applyDiscountBody,
  createCustomerBody,
  grantCreditBody,
  listCustomerQuery,
  updateCustomerBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import {
  apiKeyAuth,
  idempotency,
  idempotencyOptional,
  rateLimit,
  requireScope,
} from '@shared/middlewares';

import {
  applyCustomerDiscountController,
  createCustomerController,
  getCustomerController,
  getCustomerCreditController,
  grantCustomerCreditController,
  listCustomerController,
  removeCustomerDiscountController,
  updateCustomerController,
  voidCustomerCreditController,
} from './controllers';

/**
 * The customers resource — the first real product slice. Same fixed per-route
 * stack as every scoped resource:
 *
 *   auth → rate-limit → scope → idempotency → validate → handler
 *
 * Writes carry the `:write` scope; reads only need auth + the `:read` scope.
 * Idempotency is REQUIRED (`idempotency`) only where money moves — granting or
 * voiding customer credit — and OPTIONAL (`idempotencyOptional`, deduped-if-
 * present) on the rest (create/update/discount). (platformGate is applied app-
 * wide in `app/main/app.ts`, so it is not repeated per route.)
 */
export const customerRouter: Router = Router();

// POST /customers — create (mutating, idempotent, scoped write).
customerRouter.post(
  '/customers',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotencyOptional,
  validate({ body: createCustomerBody }),
  createCustomerController
);

// GET /customers/:id — fetch one (scoped read).
customerRouter.get(
  '/customers/:id',
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

// PATCH /customers/:id — update mutable fields (mutating, idempotent, scoped write).
customerRouter.patch(
  '/customers/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotencyOptional,
  validate({ body: updateCustomerBody }),
  updateCustomerController
);

// ── Discounts (apply / remove a coupon on the customer) ──────────────────────
customerRouter.post(
  '/customers/:id/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotencyOptional,
  validate({ body: applyDiscountBody }),
  applyCustomerDiscountController
);
customerRouter.delete(
  '/customers/:id/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotencyOptional,
  removeCustomerDiscountController
);

// ── Credit balance (grant / read) ────────────────────────────────────────────
customerRouter.post(
  '/customers/:id/credit',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotency,
  validate({ body: grantCreditBody }),
  grantCustomerCreditController
);
customerRouter.get(
  '/customers/:id/credit',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:read'),
  getCustomerCreditController
);
customerRouter.delete(
  '/customers/:id/credit/:grantId',
  apiKeyAuth,
  rateLimit,
  requireScope('customers:write'),
  idempotency,
  voidCustomerCreditController
);
