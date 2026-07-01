import { AppError } from '@nombaone/errors';
import { listWebhookEndpoints, serializeWebhookEndpoint } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookEndpointResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/webhook-endpoints. */
export const listWebhookEndpointsController: RequestHandler = jsonHandler<
  WebhookEndpointResponseData[]
>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
  const rows = await listWebhookEndpoints(db, ctx);
  return { data: rows.map(serializeWebhookEndpoint) };
});
