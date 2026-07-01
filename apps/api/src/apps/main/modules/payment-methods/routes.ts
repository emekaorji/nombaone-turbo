import { Router } from 'express';

import {
  issueVirtualAccountBody,
  listPaymentMethodQuery,
  setupCardBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  getPaymentMethodController,
  issueVirtualAccountController,
  listPaymentMethodsController,
  removePaymentMethodController,
  setDefaultPaymentMethodController,
  setupCardController,
} from './controllers';

/**
 * Payment methods — a customer's rail instances. Capture (setup-card /
 * virtual-account) initiates a flow at Nomba; the rest is management. Same fixed
 * per-route chain (auth → rate-limit → scope → idempotency → validate → handler);
 * reads skip idempotency. **N1: nothing here ever returns a token/PAN.**
 */
export const paymentMethodsRouter: Router = Router();

// ── capture flows (initiate at Nomba) ────────────────────────────────────────
paymentMethodsRouter.post(
  '/payment-methods/setup',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotency,
  validate({ body: setupCardBody }),
  setupCardController
);
paymentMethodsRouter.post(
  '/payment-methods/virtual-account',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotency,
  validate({ body: issueVirtualAccountBody }),
  issueVirtualAccountController
);

// ── reads ────────────────────────────────────────────────────────────────────
paymentMethodsRouter.get(
  '/payment-methods/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:read'),
  getPaymentMethodController
);
paymentMethodsRouter.get(
  '/payment-methods',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:read'),
  validate({ query: listPaymentMethodQuery }),
  listPaymentMethodsController
);

// ── management ───────────────────────────────────────────────────────────────
paymentMethodsRouter.post(
  '/payment-methods/:reference/default',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotency,
  setDefaultPaymentMethodController
);
paymentMethodsRouter.delete(
  '/payment-methods/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotency,
  removePaymentMethodController
);
