import { AppError } from '@nombaone/errors';
import { cancelSubscription } from '@nombaone/sara/subscriptions';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { CancelSubscriptionBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions/:reference/cancel — `mode: now` revokes immediately
 * (voluntary), `mode: at_period_end` sets the flag and stays active (A9).
 */
export const cancelSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = (req.body ?? {}) as CancelSubscriptionBody;

    const data = await cancelSubscription(db, ctx, (req.params.reference ?? ''), { mode: body.mode });
    return { data };
  }
);
