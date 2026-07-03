import { Router } from 'express';

import {
  createTestPaymentMethodBody,
  simulateWebhookBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  advanceCycleController,
  createTestPaymentMethodController,
  simulateWebhookController,
} from './controllers';

/**
 * ── Test-mode simulation instruments (`/v1/test/*`) ─────────────────────────
 * Stripe-style test helpers. This router is mounted ONLY on a test deployment
 * (see `server/routes.ts`), so the endpoints simply do not exist on live; each
 * handler also hard-refuses a non-test environment as defence in depth. They let
 * a developer make renewals, declines, OTP step-ups, and webhook deliveries
 * happen on demand — no cron wait, no real card.
 *
 * Idempotency is OPTIONAL here (dedupe-if-present): the underlying operations are
 * intrinsically idempotent (a period bills once; a method insert is a one-shot).
 */
export const testRouter: Router = Router();

// Mint a deterministic, chargeable test payment method.
testRouter.post(
  '/test/payment-methods',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotencyOptional,
  validate({ body: createTestPaymentMethodBody }),
  createTestPaymentMethodController
);

// Force the subscription's next billing cycle now (the "test clock").
testRouter.post(
  '/test/subscriptions/:id/advance-cycle',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  advanceCycleController
);

// Emit + deliver a real catalog webhook event on demand.
testRouter.post(
  '/test/webhooks/simulate',
  apiKeyAuth,
  rateLimit,
  requireScope('webhooks:write'),
  idempotencyOptional,
  validate({ body: simulateWebhookBody }),
  simulateWebhookController
);
