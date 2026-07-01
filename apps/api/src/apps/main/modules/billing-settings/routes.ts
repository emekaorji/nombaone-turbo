import { Router } from 'express';

import { updateBillingSettingsBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import { getBillingSettingsController, updateBillingSettingsController } from './controllers';

/** Per-tenant billing + dunning policy (D2/D7 config). */
export const billingSettingsRouter: Router = Router();

billingSettingsRouter.get(
  '/billing-settings',
  apiKeyAuth,
  rateLimit,
  requireScope('billing_settings:read'),
  getBillingSettingsController
);
billingSettingsRouter.put(
  '/billing-settings',
  apiKeyAuth,
  rateLimit,
  requireScope('billing_settings:write'),
  idempotency,
  validate({ body: updateBillingSettingsBody }),
  updateBillingSettingsController
);
