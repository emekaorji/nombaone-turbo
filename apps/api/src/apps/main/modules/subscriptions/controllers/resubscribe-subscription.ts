import { AppError } from '@nombaone/errors';
import { resubscribe } from '@nombaone/sara/subscriptions';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { ResubscribeBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions/:id/resubscribe — mint a NEW subscription from a
 * canceled one (the source row is never mutated, A2).
 */
export const resubscribeSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = (req.body ?? {}) as ResubscribeBody;

    const data = await resubscribe(db, ctx, (req.params.id ?? ''), {
      priceRef: body.priceId,
      paymentMethodRef: body.paymentMethodId,
    });
    return { data, statusCode: 201 };
  }
);
