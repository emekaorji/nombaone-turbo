import { AppError } from '@nombaone/errors';
import { listPlans } from '@nombaone/sara/plans';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { PlanResponseData } from '@nombaone/core-contracts/types';
import type { ListPlanQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/plans — keyset-paginated list within the caller's scope. */
export const listPlansController: RequestHandler = paginatedHandler<PlanResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const query = req.query as unknown as ListPlanQuery;

  const page = await listPlans(db, ctx, {
    status: query.status,
    limit: query.limit,
    cursor: query.cursor,
  });

  return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
});
