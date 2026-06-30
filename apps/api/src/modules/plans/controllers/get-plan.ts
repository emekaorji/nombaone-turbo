import { AppError } from '@nombaone/errors';
import { getPlanByReference } from '@nombaone/sara/plans';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/plans/:reference — resolve one plan within the caller's scope. */
export const getPlanController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof getPlanByReference>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const plan = await getPlanByReference(db, ctx, req.params.reference ?? '');

  return { data: plan };
});
