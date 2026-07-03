import { AppError } from '@nombaone/errors';
import { refundSettlement } from '@nombaone/sara/settlement';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { RefundSettlementBody } from '@nombaone/core-contracts/validations';
import type { RefundResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/settlements/:id/refund — refund the tenant share of a settlement
 * (the platform fee is non-refundable). The `Idempotency-Key` header (required by the
 * idempotency middleware) is passed as the sara-level `merchantTxRef` so the durable
 * DB `unique(merchant_tx_ref)` claim backs the Redis idempotency layer.
 */
export const refundSettlementController: RequestHandler = jsonHandler<RefundResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as RefundSettlementBody;
    const headerKey = req.headers['idempotency-key'];
    const merchantTxRef = (Array.isArray(headerKey) ? headerKey[0] : headerKey) ?? '';
    return {
      data: await refundSettlement(db, ctx, {
        reference: req.params.id ?? '',
        amountKobo: body.amountInKobo,
        merchantTxRef,
      }),
      statusCode: 201,
    };
  }
);
