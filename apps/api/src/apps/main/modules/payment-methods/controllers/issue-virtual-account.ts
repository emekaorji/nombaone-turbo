import { AppError } from '@nombaone/errors';
import { issueVirtualAccount } from '@shared/services/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';
import { getNombaClient } from '@shared/config/nomba';

import type { IssueVirtualAccountBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/payment-methods/virtual-account — issue a dedicated NUBAN (transfer
 * rail). Returns the bank/account the customer transfers into; funding reconciles
 * later via the inbound `payment_success` (`vact_transfer`).
 */
export const issueVirtualAccountController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof issueVirtualAccount>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = req.body as IssueVirtualAccountBody;

  const result = await issueVirtualAccount(getNombaClient(ctx.mode), db, ctx, {
    customerRef: body.customerRef,
    expectedAmount: body.expectedAmount,
    expiryDate: body.expiryDate,
  });

  return { data: result, statusCode: 201 };
});
