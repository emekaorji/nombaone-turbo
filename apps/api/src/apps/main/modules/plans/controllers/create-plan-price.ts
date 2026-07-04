import { AppError } from '@nombaone/errors';
import { createPrice } from '@nombaone/sara/prices';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreatePriceBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/plans/:id/prices — create (a new version of) a price under a
 * plan. The `planRef` is bound from the path; a price exists only under its plan.
 */
export const createPlanPriceController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof createPrice>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = req.body as CreatePriceBody;

  const price = await createPrice(db, ctx, {
    planRef: req.params.id ?? '',
    unitAmount: body.unitAmountInKobo,
    interval: body.interval,
    intervalCount: body.intervalCount,
    usageType: body.usageType,
    billingScheme: body.billingScheme,
    trialPeriodDays: body.trialPeriodDays,
    metadata: body.metadata,
  });

  return { data: price, statusCode: 201 };
});
