import { Router } from 'express';

import { updateTenantSettingsBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import { getTenantSettingsController, updateTenantSettingsController } from './controllers';

export const settingsRouter: Router = Router();

settingsRouter.get('/organization', apiKeyAuth, rateLimit, requireScope('organizations:read'), getTenantSettingsController);
settingsRouter.put('/organization', apiKeyAuth, rateLimit, requireScope('organizations:write'), idempotencyOptional, validate({ body: updateTenantSettingsBody }), updateTenantSettingsController);
