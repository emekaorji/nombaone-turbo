import { AppError } from '@nombaone/errors';
import { getAvailableForPayout, serializeEscrow } from '@shared/services/settlement';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { EscrowResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/settlements/escrow — the rolling 3h lock + available-to-withdraw view. */
export const getEscrowController: RequestHandler = jsonHandler<EscrowResponseData>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  return { data: serializeEscrow(await getAvailableForPayout(db, ctx)) };
});
