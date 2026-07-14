import { Router } from 'express';

import {
  addPayoutAccountBody,
  createPayoutBody,
  listSettlementsQuery,
  refundSettlementBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  addPayoutAccountController,
  createPayoutController,
  getEscrowController,
  getPayoutAccountController,
  getSettlementController,
  listBanksController,
  listSettlementsController,
  refundSettlementController,
  resolvePayoutAccountController,
} from './controllers';

export const settlementsRouter: Router = Router();

// Literal paths MUST be declared before `/settlements/:id` so 'escrow' /
// 'payout' are not captured as a settlement reference.
settlementsRouter.get('/settlements/escrow', apiKeyAuth, rateLimit, requireScope('settlements:read'), getEscrowController);
settlementsRouter.post('/settlements/payout', apiKeyAuth, rateLimit, requireScope('settlements:write'), idempotency, validate({ body: createPayoutBody }), createPayoutController);

// ── Where a merchant's money goes. Asked for at FIRST WITHDRAWAL, never at signup.
// `resolve` is name enquiry only (saves nothing) — it powers the "is this you?" step, so
// the merchant confirms the bank's answer instead of trusting their own typing.
settlementsRouter.get('/banks', apiKeyAuth, rateLimit, requireScope('settlements:read'), listBanksController);
settlementsRouter.get('/payout-accounts', apiKeyAuth, rateLimit, requireScope('settlements:read'), getPayoutAccountController);
settlementsRouter.post('/payout-accounts/resolve', apiKeyAuth, rateLimit, requireScope('settlements:write'), validate({ body: addPayoutAccountBody }), resolvePayoutAccountController);
settlementsRouter.post('/payout-accounts', apiKeyAuth, rateLimit, requireScope('settlements:write'), idempotency, validate({ body: addPayoutAccountBody }), addPayoutAccountController);

settlementsRouter.get('/settlements', apiKeyAuth, rateLimit, requireScope('settlements:read'), validate({ query: listSettlementsQuery }), listSettlementsController);
settlementsRouter.get('/settlements/:id', apiKeyAuth, rateLimit, requireScope('settlements:read'), getSettlementController);
settlementsRouter.post('/settlements/:id/refund', apiKeyAuth, rateLimit, requireScope('settlements:write'), idempotency, validate({ body: refundSettlementBody }), refundSettlementController);
