import { AppError } from '@nombaone/errors';
import { cancelSchedule } from '@shared/services/subscription-schedules';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionScheduleResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** DELETE /v1/subscriptions/:id/schedule — release the active schedule. */
export const cancelScheduleController: RequestHandler = jsonHandler<SubscriptionScheduleResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const data = await cancelSchedule(db, ctx, req.params.id ?? '');
    return { data };
  }
);
