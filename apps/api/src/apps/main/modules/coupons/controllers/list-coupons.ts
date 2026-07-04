import { AppError } from '@nombaone/errors';
import { listCoupons } from '@nombaone/sara/coupons';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { CouponResponseData } from '@nombaone/core-contracts/types';
import type { ListCouponQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/coupons — keyset-paginated. */
export const listCouponsController: RequestHandler = paginatedHandler<CouponResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const query = req.query as unknown as ListCouponQuery;

    const page = await listCoupons(db, ctx, { limit: query.limit, cursor: query.cursor });
    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
  }
);
