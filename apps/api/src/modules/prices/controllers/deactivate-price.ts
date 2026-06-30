import { AppError } from '@nombaone/errors';
import { deactivatePrice } from '@nombaone/sara/prices';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/prices/:reference/deactivate — the only price mutation: a sellability
 * state change (`active=false`), never a money edit. New "versions" are created
 * under the plan (`POST /v1/plans/:ref/prices`); raising a price = create new +
 * deactivate old.
 */
export const deactivatePriceController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof deactivatePrice>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const price = await deactivatePrice(db, ctx, req.params.reference ?? '');

  return { data: price };
});
