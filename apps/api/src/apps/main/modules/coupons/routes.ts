import { Router } from 'express';

import {
  createCouponBody,
  listCouponQuery,
  updateCouponBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  createCouponController,
  getCouponController,
  listCouponsController,
  updateCouponController,
} from './controllers';

/**
 * Coupons — reusable discount definitions. Same fixed per-route chain
 * (auth → rate-limit → scope → idempotencyOptional → validate → handler); reads skip
 * idempotencyOptional.
 */
export const couponsRouter: Router = Router();

couponsRouter.post(
  '/coupons',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:write'),
  idempotencyOptional,
  validate({ body: createCouponBody }),
  createCouponController
);
couponsRouter.get(
  '/coupons/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:read'),
  getCouponController
);
couponsRouter.get(
  '/coupons',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:read'),
  validate({ query: listCouponQuery }),
  listCouponsController
);
couponsRouter.patch(
  '/coupons/:id',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:write'),
  idempotencyOptional,
  validate({ body: updateCouponBody }),
  updateCouponController
);
