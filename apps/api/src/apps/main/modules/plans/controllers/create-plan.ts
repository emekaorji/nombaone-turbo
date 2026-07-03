import { AppError } from '@nombaone/errors';
import { createPlan } from '@nombaone/sara/plans';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreatePlanBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/plans — create a plan. */
export const createPlanController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof createPlan>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const body = req.body as CreatePlanBody;

  const plan = await createPlan(db, ctx, {
    name: body.name,
    description: body.description,
    metadata: body.metadata,
  });

  return { data: plan, statusCode: 201 };
});
