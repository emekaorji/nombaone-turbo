import { AppError } from '@nombaone/errors';
import { getSubscriptionByReference } from '@nombaone/sara/subscriptions';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:reference — fetch one within scope. */
export const getSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await getSubscriptionByReference(db, ctx, (req.params.reference ?? ''));
    return { data };
  }
);
