import { Router } from 'express';

import { nombaWebhookController } from './controller';

/**
 * Nomba inbound webhook. Mounted (in the webhook server routes) under `/v1/nomba`
 * so the full path resolves to `POST /webhooks/v1/nomba` once the webhook app is
 * mounted at `/webhooks`. Nomba's registration points at this exact path.
 */
export const nombaWebhookRouter: Router = Router();

nombaWebhookRouter.post('/', nombaWebhookController);

export default nombaWebhookRouter;
