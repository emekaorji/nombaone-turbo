import { Router } from 'express';

import {
  applyDiscountBody,
  cancelSubscriptionBody,
  changeSubscriptionBody,
  createSubscriptionBody,
  listSubscriptionQuery,
  pauseSubscriptionBody,
  resubscribeBody,
  resumeSubscriptionBody,
  scheduleChangeBody,
  updateSubscriptionBody,
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
  applySubscriptionDiscountController,
  cancelScheduleController,
  cancelSubscriptionController,
  changeSubscriptionController,
  createScheduleController,
  createSubscriptionController,
  getScheduleController,
  getSubscriptionController,
  getUpcomingInvoiceController,
  listSubscriptionEventsController,
  listSubscriptionsController,
  pauseSubscriptionController,
  removeSubscriptionDiscountController,
  resubscribeSubscriptionController,
  resumeSubscriptionController,
  updateSubscriptionController,
} from './controllers';

/**
 * Subscriptions — the engine's lifecycle surface. Create kicks the first cycle;
 * lifecycle changes are dedicated action endpoints (pause/resume/cancel/
 * resubscribe), not generic PATCH. Fixed per-route chain
 * (auth → rate-limit → scope → idempotency → validate → handler); reads skip
 * idempotency. Idempotency is REQUIRED (`idempotency`) on the money-moving
 * actions — create/change/resubscribe/cancel — and OPTIONAL
 * (`idempotencyOptional`) on the rest (update/pause/resume/schedule/discount).
 */
export const subscriptionsRouter: Router = Router();

// ── create (mutating, idempotent) ────────────────────────────────────────────
subscriptionsRouter.post(
  '/subscriptions',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: createSubscriptionBody }),
  createSubscriptionController
);

// ── reads ────────────────────────────────────────────────────────────────────
subscriptionsRouter.get(
  '/subscriptions/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getSubscriptionController
);
subscriptionsRouter.get(
  '/subscriptions',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  validate({ query: listSubscriptionQuery }),
  listSubscriptionsController
);
// The per-subscription audit trail (M) — its full domain-event history.
subscriptionsRouter.get(
  '/subscriptions/:id/events',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  listSubscriptionEventsController
);

// ── generic update (default method / metadata only) ──────────────────────────
subscriptionsRouter.patch(
  '/subscriptions/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: updateSubscriptionBody }),
  updateSubscriptionController
);

// ── lifecycle actions ────────────────────────────────────────────────────────
subscriptionsRouter.post(
  '/subscriptions/:id/pause',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: pauseSubscriptionBody }),
  pauseSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:id/resume',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: resumeSubscriptionBody }),
  resumeSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:id/cancel',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: cancelSubscriptionBody }),
  cancelSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:id/resubscribe',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: resubscribeBody }),
  resubscribeSubscriptionController
);
// Proration-triggering change (price swap / interval / quantity) — distinct from PATCH.
subscriptionsRouter.post(
  '/subscriptions/:id/change',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: changeSubscriptionBody }),
  changeSubscriptionController
);

// ── Billing schedules & upcoming invoice ─────────────────────────────────────
subscriptionsRouter.get(
  '/subscriptions/:id/upcoming-invoice',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getUpcomingInvoiceController
);
subscriptionsRouter.post(
  '/subscriptions/:id/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: scheduleChangeBody }),
  createScheduleController
);
subscriptionsRouter.get(
  '/subscriptions/:id/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getScheduleController
);
subscriptionsRouter.delete(
  '/subscriptions/:id/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  cancelScheduleController
);

// ── Discounts ────────────────────────────────────────────────────────────────
subscriptionsRouter.post(
  '/subscriptions/:id/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: applyDiscountBody }),
  applySubscriptionDiscountController
);
subscriptionsRouter.delete(
  '/subscriptions/:id/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  removeSubscriptionDiscountController
);
