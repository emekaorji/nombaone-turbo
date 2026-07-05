import { AppError } from '@nombaone/errors';
import { applyDiscount } from '@/domain/discounts';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DiscountResponseData } from '@nombaone/core-contracts/types';
import type { ApplyDiscountBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/subscriptions/:id/discount — apply a coupon to the subscription. */
export const applySubscriptionDiscountController: RequestHandler = jsonHandler<DiscountResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as ApplyDiscountBody;

    const data = await applyDiscount(db, ctx, {
      couponRefOrCode: body.coupon,
      subscriptionRef: req.params.id ?? '',
    });
    return { data, statusCode: 201 };
  }
);
