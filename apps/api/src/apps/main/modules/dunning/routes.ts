import { Router } from 'express';

import { updateSubscriptionCardBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  getDunningStateController,
  listDunningAttemptsController,
  updateSubscriptionCardController,
} from './controllers';

/**
 * Dunning inspection + the mid-dunning card-update flow. Mounted on the
 * subscriptions resource. Reads skip idempotencyOptional; the card-update write carries the
 * full chain (auth → rate-limit → scope → idempotencyOptional → validate → handler).
 */
export const dunningRouter: Router = Router();

dunningRouter.get(
  '/subscriptions/:id/dunning',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getDunningStateController
);
dunningRouter.get(
  '/subscriptions/:id/dunning/attempts',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  listDunningAttemptsController
);
dunningRouter.post(
  '/subscriptions/:id/payment-method',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotencyOptional,
  validate({ body: updateSubscriptionCardBody }),
  updateSubscriptionCardController
);
