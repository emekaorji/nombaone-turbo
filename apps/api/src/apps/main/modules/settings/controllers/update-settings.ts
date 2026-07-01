import { AppError } from '@nombaone/errors';
import { updateTenantSettings } from '@nombaone/sara/tenant-config';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { TenantSettingsResponseData } from '@nombaone/core-contracts/types';
import type { UpdateTenantSettingsBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PUT /v1/settings — tenant-editable config (no self-raise of rate limit — H6). */
export const updateTenantSettingsController: RequestHandler = jsonHandler<TenantSettingsResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
    return { data: await updateTenantSettings(db, ctx, req.body as UpdateTenantSettingsBody) };
  }
);
