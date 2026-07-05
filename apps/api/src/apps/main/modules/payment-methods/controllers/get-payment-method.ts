import { AppError } from '@nombaone/errors';
import { getPaymentMethodByReference } from '@shared/services/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/payment-methods/:id — resolve one within the caller's scope. */
export const getPaymentMethodController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof getPaymentMethodByReference>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };

  const method = await getPaymentMethodByReference(db, ctx, req.params.id ?? '');

  return { data: method };
});
