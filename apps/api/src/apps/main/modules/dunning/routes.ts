import { Router } from 'express';

import { updateSubscriptionCardBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  getDunningStateController,
  listDunningAttemptsController,
  updateSubscriptionCardController,
} from './controllers';

/**
 * Dunning inspection + the mid-dunning card-update flow. Mounted on the
 * subscriptions resource. Reads skip idempotency; the card-update write carries the
 * full chain (auth → rate-limit → scope → idempotency → validate → handler).
 */
export const dunningRouter: Router = Router();

dunningRouter.get(
  '/subscriptions/:reference/dunning',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  getDunningStateController
);
dunningRouter.get(
  '/subscriptions/:reference/dunning/attempts',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:read'),
  listDunningAttemptsController
);
dunningRouter.post(
  '/subscriptions/:reference/payment-method',
  apiKeyAuth,
  rateLimit,
  requireScope('subscriptions:write'),
  idempotency,
  validate({ body: updateSubscriptionCardBody }),
  updateSubscriptionCardController
);
