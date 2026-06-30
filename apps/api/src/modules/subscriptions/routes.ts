import { Router } from 'express';

import {
  cancelSubscriptionBody,
  createSubscriptionBody,
  listSubscriptionQuery,
  pauseSubscriptionBody,
  resubscribeBody,
  resumeSubscriptionBody,
  updateSubscriptionBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '../../shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '../../shared/middlewares';
import {
  cancelSubscriptionController,
  createSubscriptionController,
  getSubscriptionController,
  listSubscriptionsController,
  pauseSubscriptionController,
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
