import { Router } from 'express';

import { listEventQuery } from '@nombaone/core-contracts/validations';

import { validate } from '@shared/http';
import { apiKeyAuth, rateLimit, requireScope } from '@shared/middlewares';

import { getEventController, listEventsController } from './controllers';

export const eventsRouter: Router = Router();

eventsRouter.get('/events', apiKeyAuth, rateLimit, requireScope('webhooks:read'), validate({ query: listEventQuery }), listEventsController);
eventsRouter.get('/events/:reference', apiKeyAuth, rateLimit, requireScope('webhooks:read'), getEventController);
