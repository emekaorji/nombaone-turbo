import { AppError } from '@nombaone/errors';
import { pauseSubscription } from '@nombaone/sara/subscriptions';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { PauseSubscriptionBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/subscriptions/:reference/pause — active → paused (A10). */
export const pauseSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = (req.body ?? {}) as PauseSubscriptionBody;

    const data = await pauseSubscription(db, ctx, (req.params.reference ?? ''), { maxDays: body.maxDays });
    return { data };
  }
);
