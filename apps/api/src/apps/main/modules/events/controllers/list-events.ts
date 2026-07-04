import { AppError } from '@nombaone/errors';
import { listDomainEvents } from '@nombaone/sara/events';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { DomainEventResponseData } from '@nombaone/core-contracts/types';
import type { ListEventQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/events — keyset-paginated domain events, optional `type` filter. */
export const listEventsController: RequestHandler = paginatedHandler<DomainEventResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    const query = req.query as unknown as ListEventQuery;
    const page = await listDomainEvents(db, ctx, { limit: query.limit, cursor: query.cursor, type: query.type });
    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
  }
);
