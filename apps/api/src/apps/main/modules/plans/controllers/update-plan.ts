import { AppError } from '@nombaone/errors';
import { updatePlan } from '@/domain/plans';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { UpdatePlanBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PATCH /v1/plans/:id — update a plan's descriptive fields. */
export const updatePlanController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof updatePlan>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = req.body as UpdatePlanBody;

  const plan = await updatePlan(db, ctx, req.params.id ?? '', {
    name: body.name,
    description: body.description,
    metadata: body.metadata,
  });

  return { data: plan };
});
