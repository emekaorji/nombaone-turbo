import { AppError } from '@nombaone/errors';
import { removeDiscount } from '@/domain/discounts';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DiscountResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** DELETE /v1/subscriptions/:id/discount — end the active discount. */
export const removeSubscriptionDiscountController: RequestHandler = jsonHandler<DiscountResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const data = await removeDiscount(db, ctx, { subscriptionRef: req.params.id ?? '' });
    return { data };
  }
);
