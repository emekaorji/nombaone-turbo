import { AppError } from '@nombaone/errors';
import { createSchedule } from '@nombaone/sara/subscription-schedules';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { SubscriptionScheduleResponseData } from '@nombaone/core-contracts/types';
import type { ScheduleChangeBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions/:reference/schedule — schedule a price change to take
 * effect at the next cycle boundary (B10), not immediately.
 */
export const createScheduleController: RequestHandler = jsonHandler<SubscriptionScheduleResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as ScheduleChangeBody;

    const data = await createSchedule(db, ctx, {
      subscriptionRef: req.params.reference ?? '',
      priceRef: body.priceId,
      quantity: body.quantity,
      effectiveAt: body.effectiveAt,
    });
    return { data, statusCode: 201 };
  }
);
