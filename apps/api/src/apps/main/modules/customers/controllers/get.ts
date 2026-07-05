import { AppError } from '@nombaone/errors';
import { getCustomerByReference } from '@shared/services/customers';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * GET /v1/customers/:id — resolve one customer within the caller's scope.
 * The route param is a hint; sara re-resolves against the pinned (org, env), so a
 * reference from another tenant simply does not exist for this caller (404).
 */
export const getCustomerController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof getCustomerByReference>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };

  const customer = await getCustomerByReference(db, ctx, req.params.id ?? '');

  return { data: customer };
});
