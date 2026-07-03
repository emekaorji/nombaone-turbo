import { AppError } from '@nombaone/errors';
import { buildDunningState } from '@nombaone/sara/dunning';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DunningStateResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:id/dunning — inspect the dunning state + attempts. */
export const getDunningStateController: RequestHandler = jsonHandler<DunningStateResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await buildDunningState(db, ctx, req.params.id ?? '');
    return { data };
  }
);
