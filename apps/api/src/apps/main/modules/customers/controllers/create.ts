import { AppError } from '@nombaone/errors';
import { createCustomer } from '@shared/services/customers';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreateCustomerBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/customers — create a customer (subscriber).
 *
 * Tiny by design: derive the pinned `ctx` from the VERIFIED api key (never the
 * client), hand the already-validated body to sara, return the serialized
 * resource. All logic lives in `createCustomer`.
 */
export const createCustomerController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof createCustomer>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = req.body as CreateCustomerBody;

  const customer = await createCustomer(db, ctx, {
    email: body.email,
    name: body.name,
    phone: body.phone,
    metadata: body.metadata,
  });

  return { data: customer, statusCode: 201 };
});
