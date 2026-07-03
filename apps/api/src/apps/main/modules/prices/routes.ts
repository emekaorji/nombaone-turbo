import { Router } from 'express';

import { listPriceQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  deactivatePriceController,
  getPriceController,
  listPricesController,
} from './controllers';

/**
 * The global, read-mostly price surface. Prices are CREATED only under their plan
 * (`/v1/plans/:ref/prices`) and are IMMUTABLE — there is no edit path. The single
 * permitted mutation is the explicit `…/deactivate` action (a sellability state
 * change, not a money edit), which the versioning workflow uses to retire the old
 * price after creating its replacement.
 */
export const pricesRouter: Router = Router();

pricesRouter.get(
  '/prices/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('prices:read'),
  getPriceController
);
pricesRouter.get(
  '/prices',
  apiKeyAuth,
  rateLimit,
  requireScope('prices:read'),
  validate({ query: listPriceQuery }),
  listPricesController
);
pricesRouter.post(
  '/prices/:id/deactivate',
  apiKeyAuth,
  rateLimit,
  requireScope('prices:write'),
  idempotencyOptional,
  deactivatePriceController
);
