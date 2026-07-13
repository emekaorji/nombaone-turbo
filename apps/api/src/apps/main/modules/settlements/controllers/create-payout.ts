import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { getAvailableForPayout, payoutToTenant } from '@shared/services/settlement';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { getNombaClient } from '@shared/config/nomba';
import { jsonHandler } from '@shared/http';

import type { CreatePayoutBody } from '@nombaone/core-contracts/validations';
import type { PayoutResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/settlements/payout — "pay me now". Withdraws the merchant's settled balance
 * to the bank account they registered, honouring the rolling escrow lock.
 *
 * 🔒 The caller CANNOT name a destination. This body used to carry a free-text
 * `bankCode` + `accountNumber`, which meant a stolen API key could push a merchant's
 * entire balance to any account in Nigeria. The money now goes to their verified payout
 * account or nowhere.
 *
 * Omitting `amountInKobo` withdraws everything currently available — which is what the
 * console's one-click withdraw does.
 *
 * The `Idempotency-Key` header is the durable `merchantTxRef`, and it is also Nomba's
 * idempotency key, so a retried request cannot send the money twice.
 */
export const createPayoutController: RequestHandler = jsonHandler<PayoutResponseData>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };

  const body = req.body as CreatePayoutBody;
  const headerKey = req.headers['idempotency-key'];
  const merchantTxRef = (Array.isArray(headerKey) ? headerKey[0] : headerKey) ?? '';

  const amountKobo = body.amountInKobo ?? (await getAvailableForPayout(db, ctx)).availableKobo;
  if (amountKobo <= 0) {
    throw AppError.UnprocessableEntity(
      'there is nothing available to withdraw right now',
      { amountKobo },
      NOMBAONE_ERROR_CODES.PAYOUT_EXCEEDS_AVAILABLE
    );
  }

  return {
    data: await payoutToTenant(db, ctx, {
      amountKobo,
      merchantTxRef,
      client: getNombaClient(ctx.mode),
      payoutEnabled: env.NOMBA_PAYOUT_ENABLED,
    }),
    statusCode: 201,
  };
});
