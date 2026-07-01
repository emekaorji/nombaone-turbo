import { AppError } from '@nombaone/errors';
import { grantCredit } from '@nombaone/sara/credits';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreditGrantResponseData } from '@nombaone/core-contracts/types';
import type { GrantCreditBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/customers/:reference/credit — grant the customer credit. */
export const grantCustomerCreditController: RequestHandler = jsonHandler<CreditGrantResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as GrantCreditBody;

    const data = await grantCredit(db, ctx, {
      customerRef: req.params.reference ?? '',
      amount: body.amount,
      source: body.source,
      sourceReference: body.sourceReference,
      metadata: body.metadata,
    });
    return { data, statusCode: 201 };
  }
);
