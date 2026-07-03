import { AppError } from '@nombaone/errors';
import { serializeBillingSettings, upsertOrgBillingSettings } from '@nombaone/sara/org';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { BillingSettingsResponseData } from '@nombaone/core-contracts/types';
import type { UpdateBillingSettingsBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PUT /v1/organization/billing — patch the tenant's billing + dunning policy. */
export const updateBillingSettingsController: RequestHandler =
  jsonHandler<BillingSettingsResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as UpdateBillingSettingsBody;
    const settings = await upsertOrgBillingSettings(db, ctx, body);
    return { data: serializeBillingSettings(settings) };
  });
