import { AppError } from '@nombaone/errors';
import { setDefaultPaymentMethod } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/payment-methods/:id/default — make it the customer's default. */
export const setDefaultPaymentMethodController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof setDefaultPaymentMethod>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const method = await setDefaultPaymentMethod(db, ctx, req.params.id ?? '');

  return { data: method };
});
