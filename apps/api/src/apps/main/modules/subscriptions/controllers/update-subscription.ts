import { AppError } from '@nombaone/errors';
import { updateSubscription } from '@/domain/subscriptions';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { UpdateSubscriptionBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PATCH /v1/subscriptions/:id — default payment method / metadata only. */
export const updateSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as UpdateSubscriptionBody;

    const data = await updateSubscription(db, ctx, (req.params.id ?? ''), {
      defaultPaymentMethodRef: body.defaultPaymentMethodId,
      metadata: body.metadata,
    });
    return { data };
  }
);
