import { AppError } from '@nombaone/errors';
import { getCouponByReference } from '@nombaone/sara/coupons';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CouponResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/coupons/:id — fetch one within scope. */
export const getCouponController: RequestHandler = jsonHandler<CouponResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const data = await getCouponByReference(db, ctx, req.params.id ?? '');
  return { data };
});
