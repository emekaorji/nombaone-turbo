import { AppError } from '@nombaone/errors';
import { updateCustomer } from '@nombaone/sara/customers';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { UpdateCustomerBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * PATCH /v1/customers/:reference — update a customer's mutable fields (email is
 * immutable). Scoped, idempotent. sara re-resolves the reference within scope.
 */
export const updateCustomerController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof updateCustomer>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const body = req.body as UpdateCustomerBody;

  const customer = await updateCustomer(db, ctx, req.params.reference ?? '', {
    name: body.name,
    phone: body.phone,
    metadata: body.metadata,
  });

  return { data: customer };
});
