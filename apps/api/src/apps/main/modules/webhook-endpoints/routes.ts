import { Router } from 'express';

import { createWebhookEndpointBody, updateWebhookEndpointBody } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  createWebhookEndpointController,
  deleteWebhookEndpointController,
  getWebhookEndpointController,
  listWebhookEndpointsController,
  rotateWebhookSecretController,
  updateWebhookEndpointController,
} from './controllers';

export const webhookEndpointsRouter: Router = Router();

webhookEndpointsRouter.post('/webhook-endpoints', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotency, validate({ body: createWebhookEndpointBody }), createWebhookEndpointController);
webhookEndpointsRouter.get('/webhook-endpoints', apiKeyAuth, rateLimit, requireScope('webhooks:read'), listWebhookEndpointsController);
webhookEndpointsRouter.get('/webhook-endpoints/:reference', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getWebhookEndpointController);
webhookEndpointsRouter.patch('/webhook-endpoints/:reference', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotency, validate({ body: updateWebhookEndpointBody }), updateWebhookEndpointController);
webhookEndpointsRouter.delete('/webhook-endpoints/:reference', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotency, deleteWebhookEndpointController);
webhookEndpointsRouter.post('/webhook-endpoints/:reference/rotate-secret', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotency, rotateWebhookSecretController);
