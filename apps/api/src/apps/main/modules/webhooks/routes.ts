import { Router } from 'express';

import {
  createWebhookEndpointBody,
  listWebhookDeliveryQuery,
  updateWebhookEndpointBody,
} from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotencyOptional, rateLimit, requireScope } from '@shared/middlewares';

import {
  createWebhookEndpointController,
  deleteWebhookEndpointController,
  getWebhookDeliveryController,
  getWebhookEndpointController,
  listWebhookDeliveriesController,
  listWebhookEndpointsController,
  replayWebhookDeliveryController,
  rotateWebhookSecretController,
  updateWebhookEndpointController,
} from './controllers';

export const webhooksRouter: Router = Router();

// ── Webhook endpoints ────────────────────────────────────────────────────────
webhooksRouter.post('/webhooks', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotencyOptional, validate({ body: createWebhookEndpointBody }), createWebhookEndpointController);
webhooksRouter.get('/webhooks', apiKeyAuth, rateLimit, requireScope('webhooks:read'), listWebhookEndpointsController);
webhooksRouter.get('/webhooks/:id', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getWebhookEndpointController);
webhooksRouter.patch('/webhooks/:id', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotencyOptional, validate({ body: updateWebhookEndpointBody }), updateWebhookEndpointController);
webhooksRouter.delete('/webhooks/:id', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotencyOptional, deleteWebhookEndpointController);
webhooksRouter.post('/webhooks/:id/rotate-secret', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotencyOptional, rotateWebhookSecretController);

// ── Nested deliveries ────────────────────────────────────────────────────────
// The inner delivery param is `:deliveryId` (NOT a second `:id`) — Express silently
// overwrites duplicate param names, so `/webhooks/:id/deliveries/:id` would lose the
// webhook id. The URL a developer builds is unchanged: `/webhooks/{id}/deliveries/{deliveryId}`.
webhooksRouter.get('/webhooks/:id/deliveries', apiKeyAuth, rateLimit, requireScope('webhooks:read'), validate({ query: listWebhookDeliveryQuery }), listWebhookDeliveriesController);
webhooksRouter.get('/webhooks/:id/deliveries/:deliveryId', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getWebhookDeliveryController);
webhooksRouter.post('/webhooks/:id/deliveries/:deliveryId/replay', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotencyOptional, replayWebhookDeliveryController);
