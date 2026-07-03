import { Router } from 'express';

import { WEBHOOK_EVENT_CATALOG } from '@nombaone/core-contracts/types';
import { listEventQuery } from '@nombaone/core-contracts/validations';

import { jsonHandler, validate } from '@shared/http';
import { apiKeyAuth, rateLimit, requireScope } from '@shared/middlewares';

import { getEventController, listEventsController } from './controllers';

export const eventsRouter: Router = Router();

// Public, machine-readable webhook event catalog (L — "webhook reference is public").
// Declared BEFORE `/events/:id` so `catalog` is not captured as a reference.
eventsRouter.get(
  '/events/catalog',
  jsonHandler(() => ({ data: WEBHOOK_EVENT_CATALOG }))
);
eventsRouter.get('/events', apiKeyAuth, rateLimit, requireScope('webhooks:read'), validate({ query: listEventQuery }), listEventsController);
eventsRouter.get('/events/:id', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getEventController);
