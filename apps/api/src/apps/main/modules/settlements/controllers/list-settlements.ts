import { AppError } from '@nombaone/errors';
import { listSettlements } from '@nombaone/sara/settlement';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { SettlementResponseData } from '@nombaone/core-contracts/types';
import type { ListSettlementsQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/settlements — keyset-paginated, optional status filter. */
export const listSettlementsController: RequestHandler = paginatedHandler<SettlementResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    const q = req.query as unknown as ListSettlementsQuery;
    const page = await listSettlements(db, ctx, { limit: q.limit, cursor: q.cursor, status: q.status });
    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: q.limit };
  }
);
