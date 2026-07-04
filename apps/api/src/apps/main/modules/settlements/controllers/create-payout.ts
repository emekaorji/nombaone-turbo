import { AppError } from '@nombaone/errors';
import { payoutToTenant } from '@nombaone/sara/settlement';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { getNombaClient } from '@shared/config/nomba';
import { jsonHandler } from '@shared/http';

import type { CreatePayoutBody } from '@nombaone/core-contracts/validations';
import type { PayoutResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/settlements/payout — tenant-level withdrawal of settled funds, honouring
 * the rolling escrow lock. The `Idempotency-Key` header (required by the idempotency
 * middleware) is the durable `merchantTxRef`. The provider `bankTransfer` fires only
 * when `NOMBA_PAYOUT_ENABLED` is set (⚠ unconfirmed API).
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
  return {
    data: await payoutToTenant(db, ctx, {
      amountKobo: body.amountInKobo,
      bank: { code: body.bankCode, accountNumber: body.accountNumber },
      merchantTxRef,
      client: getNombaClient(ctx.mode),
      payoutEnabled: env.NOMBA_PAYOUT_ENABLED,
    }),
    statusCode: 201,
  };
});
