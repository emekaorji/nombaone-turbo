import { AppError } from '@nombaone/errors';
import { getActiveScheduleForSubscription } from '@nombaone/sara/subscription-schedules';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { SubscriptionScheduleResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:reference/schedule — the active schedule (or 404). */
export const getScheduleController: RequestHandler = jsonHandler<SubscriptionScheduleResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await getActiveScheduleForSubscription(db, ctx, req.params.reference ?? '');
    return { data };
  }
);
