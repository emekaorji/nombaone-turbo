import { AppError } from '@nombaone/errors';
import { startSubscription } from '@nombaone/sara/billing';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { CreateSubscriptionBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions — create a subscription and kick its first cycle. A
 * `charge_automatically` sub with no trial charges immediately (→ active|past_due);
 * a trial / send_invoice sub is created without a charge. Idempotent (Idempotency-Key).
 */
export const createSubscriptionController: RequestHandler = jsonHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as CreateSubscriptionBody;

    const data = await startSubscription(db, ctx, {
      customerRef: body.customerId,
      priceRef: body.priceId,
      paymentMethodRef: body.paymentMethodId,
      collectionMethod: body.collectionMethod,
      trialDays: body.trialDays,
      quantity: body.quantity,
      metadata: body.metadata,
    });

    return { data, statusCode: 201 };
  }
);
