import { Router } from 'express';

import { listSettlementsQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, rateLimit, requireScope } from '@shared/middlewares';

import { getSettlementController, listSettlementsController } from './controllers';

export const settlementsRouter: Router = Router();

settlementsRouter.get('/settlements', apiKeyAuth, rateLimit, requireScope('settlements:read'), validate({ query: listSettlementsQuery }), listSettlementsController);
settlementsRouter.get('/settlements/:reference', apiKeyAuth, rateLimit, requireScope('settlements:read'), getSettlementController);
