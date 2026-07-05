import { AppError } from '@nombaone/errors';
import { getCreditBalanceResponse } from '@shared/services/credits';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreditBalanceResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/customers/:id/credit — the credit balance + grant audit list. */
export const getCustomerCreditController: RequestHandler = jsonHandler<CreditBalanceResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const data = await getCreditBalanceResponse(db, ctx, req.params.id ?? '');
    return { data };
  }
);
