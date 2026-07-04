import { AppError } from '@nombaone/errors';
import { createTestPaymentMethod } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { PaymentMethodResponseData } from '@nombaone/core-contracts/types';
import type { CreateTestPaymentMethodBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/sandbox/payment-methods — mint a deterministic, chargeable test payment
 * method (test deployments only). Its `behavior` fixes what every charge does.
 */
export const createTestPaymentMethodController: RequestHandler =
  jsonHandler<PaymentMethodResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as CreateTestPaymentMethodBody;
    const data = await createTestPaymentMethod(db, ctx, {
      customerRef: body.customerId,
      behavior: body.behavior,
      kind: body.kind,
    });
    return { data, statusCode: 201 };
  });
