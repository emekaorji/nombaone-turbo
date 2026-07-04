import { AppError } from '@nombaone/errors';
import { resumeSubscription } from '@nombaone/sara/subscriptions';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/subscriptions/:id/resume — paused → active, next bill recomputed (A10). */
export const resumeSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const data = await resumeSubscription(db, ctx, (req.params.id ?? ''));
    return { data };
  }
);
