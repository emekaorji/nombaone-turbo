import { AppError } from '@nombaone/errors';
import { updateCoupon } from '@shared/services/coupons';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CouponResponseData } from '@nombaone/core-contracts/types';
import type { UpdateCouponBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PATCH /v1/coupons/:id — redeemBy / maxRedemptions / metadata only. */
export const updateCouponController: RequestHandler = jsonHandler<CouponResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = req.body as UpdateCouponBody;

  const data = await updateCoupon(db, ctx, req.params.id ?? '', {
    redeemBy: body.redeemBy,
    maxRedemptions: body.maxRedemptions,
    metadata: body.metadata,
  });
  return { data };
});
