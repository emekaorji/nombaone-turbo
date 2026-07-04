import { AppError } from '@nombaone/errors';
import { updateCardOnSubscription } from '@nombaone/sara/dunning';
import { serializePaymentMethod } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { PaymentMethodResponseData } from '@nombaone/core-contracts/types';
import type { UpdateSubscriptionCardBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/subscriptions/:id/payment-method — swap the card mid-dunning
 * (atomic token swap) and prompt an immediate re-attempt (D10 / E6 ★).
 */
export const updateSubscriptionCardController: RequestHandler =
  jsonHandler<PaymentMethodResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as UpdateSubscriptionCardBody;
    const { method, customerRef } = await updateCardOnSubscription(db, ctx, {
      subscriptionRef: req.params.id ?? '',
      paymentMethodReference: body.paymentMethodReference,
      checkoutToken: body.checkoutToken,
    });
    return { data: serializePaymentMethod(method, customerRef) };
  });
