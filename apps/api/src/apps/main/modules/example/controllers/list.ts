import { AppError } from '@nombaone/errors';
import { listExamples } from '@nombaone/sara/example';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { ExampleResponseData } from '@nombaone/core-contracts/types';
import type { ListExampleQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * GET /v1/examples — keyset-paginated list within the caller's scope.
 *
 * The validated query (coerced `limit`, optional `kind`/`cursor`) is handed to
 * sara, which returns a `Page<ExampleResponseData>`. We unwrap that page into the
 * paginated envelope's shape; the opaque cursor + clamped limit come straight
 * from the domain.
 */
export const listExampleController: RequestHandler = paginatedHandler<ExampleResponseData>(
  async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const query = req.query as unknown as ListExampleQuery;

  const page = await listExamples(db, ctx, {
    kind: query.kind,
    limit: query.limit,
    cursor: query.cursor,
  });

  return {
    data: page.data,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    limit: query.limit,
  };
});
