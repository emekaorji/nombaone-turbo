import { AppError } from '@nombaone/errors';
import { voidCreditGrant } from '@nombaone/sara/credits';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreditGrantResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** DELETE /v1/customers/:reference/credit/:grantReference — void an unconsumed credit grant. */
export const voidCustomerCreditController: RequestHandler = jsonHandler<CreditGrantResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await voidCreditGrant(db, ctx, { reference: req.params.grantReference ?? '' });
    return { data };
  }
);
