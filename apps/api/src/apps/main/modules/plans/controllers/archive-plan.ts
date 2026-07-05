import { AppError } from '@nombaone/errors';
import { archivePlan } from '@shared/services/plans';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/plans/:id/archive — retire a plan (an explicit named action,
 * never a `DELETE`; the O1 guard blocks archiving a plan with active subscribers).
 */
export const archivePlanController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof archivePlan>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };

  const plan = await archivePlan(db, ctx, req.params.id ?? '');

  return { data: plan };
});
