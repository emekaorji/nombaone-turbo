import { Router } from 'express';

import {
  createCouponBody,
  listCouponQuery,
  updateCouponBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  createCouponController,
  getCouponController,
  listCouponsController,
  updateCouponController,
} from './controllers';

/**
 * Coupons — reusable discount definitions. Same fixed per-route chain
 * (auth → rate-limit → scope → idempotency → validate → handler); reads skip
 * idempotency.
 */
export const couponsRouter: Router = Router();

couponsRouter.post(
  '/coupons',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:write'),
  idempotency,
  validate({ body: createCouponBody }),
  createCouponController
);
couponsRouter.get(
  '/coupons/:reference',
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
  '/coupons/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('coupons:write'),
  idempotency,
  validate({ body: updateCouponBody }),
  updateCouponController
);
