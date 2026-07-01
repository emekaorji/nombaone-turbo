import { AppError } from '@nombaone/errors';
import { getWebhookDelivery } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookDeliveryResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/webhook-deliveries/:reference. */
export const getWebhookDeliveryController: RequestHandler =
  jsonHandler<WebhookDeliveryResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
    return { data: await getWebhookDelivery(db, ctx, req.params.reference ?? '') };
  });
