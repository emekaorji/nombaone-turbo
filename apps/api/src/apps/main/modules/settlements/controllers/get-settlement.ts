import { AppError } from '@nombaone/errors';
import { getSettlementByReference } from '@nombaone/sara/settlement';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { SettlementResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/settlements/:id. */
export const getSettlementController: RequestHandler = jsonHandler<SettlementResponseData>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
  return { data: await getSettlementByReference(db, ctx, req.params.id ?? '') };
});
