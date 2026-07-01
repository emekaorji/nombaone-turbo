import { Router } from 'express';

import { listWebhookDeliveryQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '@shared/middlewares';

import {
  getWebhookDeliveryController,
  listWebhookDeliveriesController,
  replayWebhookDeliveryController,
} from './controllers';

export const webhookDeliveriesRouter: Router = Router();

webhookDeliveriesRouter.get('/webhook-deliveries', apiKeyAuth, rateLimit, requireScope('webhooks:read'), validate({ query: listWebhookDeliveryQuery }), listWebhookDeliveriesController);
webhookDeliveriesRouter.get('/webhook-deliveries/:reference', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getWebhookDeliveryController);
webhookDeliveriesRouter.post('/webhook-deliveries/:reference/replay', apiKeyAuth, rateLimit, requireScope('webhooks:write'), idempotency, replayWebhookDeliveryController);
