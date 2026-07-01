import { AppError } from '@nombaone/errors';
import { getCreditBalanceResponse } from '@nombaone/sara/credits';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreditBalanceResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/customers/:reference/credit — the credit balance + grant audit list. */
export const getCustomerCreditController: RequestHandler = jsonHandler<CreditBalanceResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await getCreditBalanceResponse(db, ctx, req.params.reference ?? '');
    return { data };
  }
);
