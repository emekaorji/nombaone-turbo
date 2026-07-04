import { AppError } from '@nombaone/errors';
import { listWebhookDeliveries } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { WebhookDeliveryResponseData } from '@nombaone/core-contracts/types';
import type { ListWebhookDeliveryQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/webhooks/:id/deliveries — a webhook's deliveries, keyset-paginated. */
export const listWebhookDeliveriesController: RequestHandler =
  paginatedHandler<WebhookDeliveryResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    const q = req.query as unknown as ListWebhookDeliveryQuery;
    const page = await listWebhookDeliveries(db, ctx, {
      limit: q.limit, cursor: q.cursor, status: q.status, eventType: q.eventType, endpoint: req.params.id,
    });
    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: q.limit };
  });
