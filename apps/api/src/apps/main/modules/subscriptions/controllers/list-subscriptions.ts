import { AppError } from '@nombaone/errors';

import { listSubscriptions } from '@shared/services/subscriptions';
import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { SubscriptionResponseData } from '@nombaone/core-contracts/types';
import type { ListSubscriptionQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions — keyset-paginated, optional `customerId`/`status` filters. */
export const listSubscriptionsController: RequestHandler = paginatedHandler<SubscriptionResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const query = req.query as unknown as ListSubscriptionQuery;

    const page = await listSubscriptions(db, ctx, {
      customerRef: query.customerId,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });

    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
  }
);
