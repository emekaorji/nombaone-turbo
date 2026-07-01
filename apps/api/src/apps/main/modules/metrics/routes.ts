import { Router } from 'express';

import { metricsQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, rateLimit, requireScope } from '@shared/middlewares';

import { getBillingMetricsController } from './controllers';

export const metricsRouter: Router = Router();

metricsRouter.get('/metrics/billing', apiKeyAuth, rateLimit, requireScope('metrics:read'), validate({ query: metricsQuery }), getBillingMetricsController);
