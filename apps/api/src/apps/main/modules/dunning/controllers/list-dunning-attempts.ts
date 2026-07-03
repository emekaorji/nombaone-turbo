import { AppError } from '@nombaone/errors';
import { getDunningStateBySubscriptionRef, serializeDunningAttempt } from '@nombaone/sara/dunning';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DunningAttemptResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:id/dunning/attempts — the full attempt log (D11). */
export const listDunningAttemptsController: RequestHandler = jsonHandler<
  DunningAttemptResponseData[]
>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const { attempts } = await getDunningStateBySubscriptionRef(db, ctx, req.params.id ?? '');
  return { data: attempts.map(serializeDunningAttempt) };
});
