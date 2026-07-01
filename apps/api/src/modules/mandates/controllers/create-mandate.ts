import { AppError } from '@nombaone/errors';
import { createMandate } from '@nombaone/sara/payment-methods';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';
import { getNombaClient } from '../../../shared/config/nomba';

import type { CreateMandateBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/mandates — create a direct-debit mandate. Returns the NIBSS ₦50
 * validation instruction the customer must complete; status is `consent_pending`
 * until polled active.
 */
export const createMandateController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof createMandate>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    environment: req.apiKey.environment,
  };
  const body = req.body as CreateMandateBody;

  const result = await createMandate(getNombaClient(), db, ctx, {
    customerRef: body.customerRef,
    customerAccountNumber: body.customerAccountNumber,
    bankCode: body.bankCode,
    customerName: body.customerName,
    customerAccountName: body.customerAccountName,
    customerPhoneNumber: body.customerPhoneNumber,
    customerAddress: body.customerAddress,
    narration: body.narration,
    maxAmount: body.maxAmount,
    frequency: body.frequency,
    startDate: body.startDate,
    endDate: body.endDate,
  });

  return { data: result, statusCode: 201 };
});
