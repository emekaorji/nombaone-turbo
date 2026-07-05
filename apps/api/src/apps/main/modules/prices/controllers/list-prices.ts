import { AppError } from '@nombaone/errors';
import { listPrices } from '@/domain/prices';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { PriceResponseData } from '@nombaone/core-contracts/types';
import type { ListPriceQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/prices — keyset-paginated price lookup (optional `planRef`/`active`). */
export const listPricesController: RequestHandler = paginatedHandler<PriceResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const query = req.query as unknown as ListPriceQuery;

    const page = await listPrices(db, ctx, {
      planRef: query.planRef,
      active: query.active,
      limit: query.limit,
      cursor: query.cursor,
    });

    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
  }
);
