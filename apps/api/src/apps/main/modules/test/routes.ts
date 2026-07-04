import { Router } from 'express';

import {
  createTestPaymentMethodBody,
  simulateWebhookBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import {
  apiKeyAuth,
  idempotencyOptional,
  rateLimit,
  requireSandboxMode,
  requireScope,
} from '@shared/middlewares';

import {
  advanceCycleController,
  createTestPaymentMethodController,
  simulateWebhookController,
} from './controllers';

/**
 * ── Sandbox simulation instruments (`/v1/sandbox/*`) ───────────────────────────
 * Stripe-style test helpers. ONE process serves both modes, so this router is
 * always mounted; `requireSandboxMode` (right after `apiKeyAuth`) refuses any
 * `live`-mode key, and each handler re-checks `ctx.mode` as defence in depth — so
 * the instruments only ever act in sandbox. They let a developer make renewals,
 * declines, OTP step-ups, and webhook deliveries happen on demand — no cron wait,
 * no real card.
 *
 * Idempotency is OPTIONAL here (dedupe-if-present): the underlying operations are
 * intrinsically idempotent (a period bills once; a method insert is a one-shot).
 */
export const testRouter: Router = Router();

// Mint a deterministic, chargeable test payment method.
testRouter.post(
  '/sandbox/payment-methods',
  apiKeyAuth,
  requireSandboxMode,
  rateLimit,
  requireScope('payment_methods:write'),
  idempotencyOptional,
  validate({ body: createTestPaymentMethodBody }),
  createTestPaymentMethodController
);

// Force the subscription's next billing cycle now (the "test clock").
testRouter.post(
  '/sandbox/subscriptions/:id/advance-cycle',
  apiKeyAuth,
  requireSandboxMode,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  advanceCycleController
);

// Emit + deliver a real catalog webhook event on demand.
testRouter.post(
  '/sandbox/webhooks/simulate',
  apiKeyAuth,
  requireSandboxMode,
  rateLimit,
  requireScope('webhooks:write'),
  idempotencyOptional,
  validate({ body: simulateWebhookBody }),
  simulateWebhookController
);
