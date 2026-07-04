import { AppError } from '@nombaone/errors';
import { disableWebhookEndpoint, getWebhookEndpoint, serializeWebhookEndpoint } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookEndpointResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** DELETE /v1/webhooks/:id — soft-disable. */
export const deleteWebhookEndpointController: RequestHandler =
  jsonHandler<WebhookEndpointResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    const reference = req.params.id ?? '';
    await disableWebhookEndpoint(db, ctx, reference);
    return { data: serializeWebhookEndpoint(await getWebhookEndpoint(db, ctx, reference)) };
  });
