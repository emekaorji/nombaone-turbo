import { Router } from 'express';

import { updateTenantSettingsBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import { getTenantSettingsController, updateTenantSettingsController } from './controllers';

export const settingsRouter: Router = Router();

settingsRouter.get('/settings', apiKeyAuth, rateLimit, requireScope('settings:read'), getTenantSettingsController);
settingsRouter.put('/settings', apiKeyAuth, rateLimit, requireScope('settings:write'), idempotency, validate({ body: updateTenantSettingsBody }), updateTenantSettingsController);
