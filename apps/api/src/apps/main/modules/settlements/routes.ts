import { Router } from 'express';

import {
  createPayoutBody,
  listSettlementsQuery,
  refundSettlementBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  createPayoutController,
  getEscrowController,
  getSettlementController,
  listSettlementsController,
  refundSettlementController,
} from './controllers';

export const settlementsRouter: Router = Router();

// Literal paths MUST be declared before `/settlements/:reference` so 'escrow' /
// 'payout' are not captured as a settlement reference.
settlementsRouter.get('/settlements/escrow', apiKeyAuth, rateLimit, requireScope('settlements:read'), getEscrowController);
settlementsRouter.post('/settlements/payout', apiKeyAuth, rateLimit, requireScope('settlements:write'), idempotency, validate({ body: createPayoutBody }), createPayoutController);

settlementsRouter.get('/settlements', apiKeyAuth, rateLimit, requireScope('settlements:read'), validate({ query: listSettlementsQuery }), listSettlementsController);
settlementsRouter.get('/settlements/:reference', apiKeyAuth, rateLimit, requireScope('settlements:read'), getSettlementController);
settlementsRouter.post('/settlements/:reference/refund', apiKeyAuth, rateLimit, requireScope('settlements:write'), idempotency, validate({ body: refundSettlementBody }), refundSettlementController);
