import { Router } from 'express';

import { createMandateBody } from '@nombaone/core-contracts/validations';

import { validate } from '../../shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '../../shared/middlewares';
import { createMandateController, getMandateStatusController } from './controllers';

/**
 * Direct-debit mandates — the consent-gated bank-account pull rail. Create returns
 * the NIBSS ₦50 instruction; status is polled to active before any debit.
 */
export const mandatesRouter: Router = Router();

mandatesRouter.post(
  '/mandates',
  apiKeyAuth,
  rateLimit,
  requireScope('mandates:write'),
  idempotency,
  validate({ body: createMandateBody }),
  createMandateController
);
mandatesRouter.get(
  '/mandates/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('payment_methods:read'),
  getMandateStatusController
);
