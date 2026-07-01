import { AppError } from '@nombaone/errors';
import { createWebhookEndpoint, getWebhookEndpoint, serializeWebhookEndpoint } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookEndpointResponseData } from '@nombaone/core-contracts/types';
import type { CreateWebhookEndpointBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

const ctxOf = (req: Parameters<RequestHandler>[0]): DomainContext => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  return { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
};

/** POST /v1/webhook-endpoints — the signing secret escapes ONCE. */
export const createWebhookEndpointController: RequestHandler = jsonHandler<
  WebhookEndpointResponseData & { signingSecret: string }
>(async (req) => {
  const ctx = ctxOf(req);
  const body = req.body as CreateWebhookEndpointBody;
  const { reference, signingSecret } = await createWebhookEndpoint(db, ctx, {
    url: body.url,
    enabledEvents: body.enabledEvents,
  });
  const endpoint = await getWebhookEndpoint(db, ctx, reference);
  return { data: { ...serializeWebhookEndpoint(endpoint), signingSecret }, statusCode: 201 };
});
