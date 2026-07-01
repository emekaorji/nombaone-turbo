import { AppError } from '@nombaone/errors';
import { serializeWebhookEndpoint, updateWebhookEndpoint } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookEndpointResponseData } from '@nombaone/core-contracts/types';
import type { UpdateWebhookEndpointBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** PATCH /v1/webhook-endpoints/:reference. */
export const updateWebhookEndpointController: RequestHandler =
  jsonHandler<WebhookEndpointResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
    const body = req.body as UpdateWebhookEndpointBody;
    const row = await updateWebhookEndpoint(db, ctx, req.params.reference ?? '', body);
    return { data: serializeWebhookEndpoint(row) };
  });
