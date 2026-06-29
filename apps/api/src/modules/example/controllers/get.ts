import { AppError } from '@nombaone/errors';
import { getExampleByReference } from '@nombaone/sara/example';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * GET /v1/examples/:reference — resolve one example within the caller's scope.
 *
 * The route param is just a hint: sara re-resolves the reference against the
 * caller's pinned (org, env), so a reference from another tenant simply does not
 * exist for this caller (404 EXAMPLE_NOT_FOUND).
 */
export const getExampleController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof getExampleByReference>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const example = await getExampleByReference(db, ctx, req.params.reference ?? '');

  return { data: example };
});
