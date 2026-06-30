import { AppError } from '@nombaone/errors';
import { changeSubscription } from '@nombaone/sara/billing';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { ChangeSubscriptionBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions/:reference/change — a proration-triggering change (price
 * swap / interval switch / quantity). Distinct from PATCH (metadata/default method).
 */
export const changeSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as ChangeSubscriptionBody;

    const data = await changeSubscription(db, ctx, req.params.reference ?? '', {
      priceRef: body.priceId,
      quantity: body.quantity,
      intervalSwitch: body.intervalSwitch,
      prorationBehavior: body.prorationBehavior,
    });
    return { data };
  }
);
