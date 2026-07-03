import { AppError } from '@nombaone/errors';
import { setupCard } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';
import { getNombaClient } from '@shared/config/nomba';

import type { SetupCardBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/payment-methods/setup — initiate hosted-checkout card tokenization.
 * Returns the `checkoutLink` to redirect the customer to; the saved card is
 * captured later from the `payment_success` webhook (E1).
 */
export const setupCardController: RequestHandler = jsonHandler<Awaited<ReturnType<typeof setupCard>>>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as SetupCardBody;

    const result = await setupCard(getNombaClient(), db, ctx, {
      customerRef: body.customerRef,
      amount: body.amountInKobo,
      callbackUrl: body.callbackUrl,
    });

    return { data: result, statusCode: 201 };
  }
);
