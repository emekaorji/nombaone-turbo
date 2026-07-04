import { AppError } from '@nombaone/errors';
import { replayDelivery } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookDeliveryResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/webhooks/:id/deliveries/:deliveryId/replay — re-arm a dead/failed delivery (G6). */
export const replayWebhookDeliveryController: RequestHandler =
  jsonHandler<WebhookDeliveryResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    return { data: await replayDelivery(db, ctx, req.params.deliveryId ?? '') };
  });
