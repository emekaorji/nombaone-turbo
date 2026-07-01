import { AppError } from '@nombaone/errors';
import { removePaymentMethod } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';
import { getNombaClient } from '@shared/config/nomba';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** DELETE /v1/payment-methods/:reference — revoke the token at Nomba, mark removed (E7). */
export const removePaymentMethodController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof removePaymentMethod>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };

  const method = await removePaymentMethod(getNombaClient(), db, ctx, {
    reference: req.params.reference ?? '',
  });

  return { data: method };
});
