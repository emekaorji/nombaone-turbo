import { AppError } from '@nombaone/errors';
import { getOrgBillingSettings, serializeBillingSettings } from '@nombaone/sara/org';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { BillingSettingsResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/organization/billing — the tenant's current billing + dunning policy. */
export const getBillingSettingsController: RequestHandler =
  jsonHandler<BillingSettingsResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const settings = await getOrgBillingSettings(db, ctx);
    return { data: serializeBillingSettings(settings) };
  });
