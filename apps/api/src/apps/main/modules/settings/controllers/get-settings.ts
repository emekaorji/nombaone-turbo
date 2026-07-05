import { AppError } from '@nombaone/errors';
import { getTenantSettings } from '@shared/services/tenant-config';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { TenantSettingsResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/organization — the unified tenant config (H4). Secret withheld. */
export const getTenantSettingsController: RequestHandler = jsonHandler<TenantSettingsResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    return { data: await getTenantSettings(db, ctx) };
  }
);
