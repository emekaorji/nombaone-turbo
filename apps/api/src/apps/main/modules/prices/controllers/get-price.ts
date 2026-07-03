import { AppError } from '@nombaone/errors';
import { getPriceByReference } from '@nombaone/sara/prices';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/prices/:id — resolve one price within the caller's scope. */
export const getPriceController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof getPriceByReference>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const price = await getPriceByReference(db, ctx, req.params.id ?? '');

  return { data: price };
});
