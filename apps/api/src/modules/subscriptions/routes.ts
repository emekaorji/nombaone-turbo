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

import { validate } from '../../shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '../../shared/middlewares';
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
 * resubscribe), not generic PATCH. Same fixed per-route chain
 * (auth → rate-limit → scope → idempotency → validate → handler); reads skip
 * idempotency.
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
  '/subscriptions/:reference',
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

// ── generic update (default method / metadata only) ──────────────────────────
subscriptionsRouter.patch(
  '/subscriptions/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: updateSubscriptionBody }),
  updateSubscriptionController
);

// ── lifecycle actions ────────────────────────────────────────────────────────
subscriptionsRouter.post(
  '/subscriptions/:reference/pause',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: pauseSubscriptionBody }),
  pauseSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:reference/resume',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: resumeSubscriptionBody }),
  resumeSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:reference/cancel',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: cancelSubscriptionBody }),
  cancelSubscriptionController
);
subscriptionsRouter.post(
  '/subscriptions/:reference/resubscribe',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: resubscribeBody }),
  resubscribeSubscriptionController
);
// Proration-triggering change (price swap / interval / quantity) — distinct from PATCH.
subscriptionsRouter.post(
  '/subscriptions/:reference/change',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: changeSubscriptionBody }),
  changeSubscriptionController
);

// ── Billing schedules & upcoming invoice ─────────────────────────────────────
subscriptionsRouter.get(
  '/subscriptions/:reference/upcoming-invoice',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getUpcomingInvoiceController
);
subscriptionsRouter.post(
  '/subscriptions/:reference/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: scheduleChangeBody }),
  createScheduleController
);
subscriptionsRouter.get(
  '/subscriptions/:reference/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getScheduleController
);
subscriptionsRouter.delete(
  '/subscriptions/:reference/schedule',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  cancelScheduleController
);

// ── Discounts ────────────────────────────────────────────────────────────────
subscriptionsRouter.post(
  '/subscriptions/:reference/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: applyDiscountBody }),
  applySubscriptionDiscountController
);
subscriptionsRouter.delete(
  '/subscriptions/:reference/discount',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  removeSubscriptionDiscountController
);
