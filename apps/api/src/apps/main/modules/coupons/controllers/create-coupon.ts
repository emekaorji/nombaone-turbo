import { AppError } from '@nombaone/errors';
import { createCoupon } from '@nombaone/sara/coupons';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CouponResponseData } from '@nombaone/core-contracts/types';
import type { CreateCouponBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/coupons — create a coupon definition. */
export const createCouponController: RequestHandler = jsonHandler<CouponResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const body = req.body as CreateCouponBody;

  const data = await createCoupon(db, ctx, {
    code: body.code,
    amountOff: body.amountOff,
    percentOff: body.percentOff,
    duration: body.duration,
    durationInCycles: body.durationInCycles,
    redeemBy: body.redeemBy,
    maxRedemptions: body.maxRedemptions,
    metadata: body.metadata,
  });
  return { data, statusCode: 201 };
});
