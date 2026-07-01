import { AppError } from '@nombaone/errors';
import { getWebhookEndpoint, serializeWebhookEndpoint } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookEndpointResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/webhook-endpoints/:reference. */
export const getWebhookEndpointController: RequestHandler = jsonHandler<WebhookEndpointResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
    const row = await getWebhookEndpoint(db, ctx, req.params.reference ?? '');
    return { data: serializeWebhookEndpoint(row) };
  }
);
