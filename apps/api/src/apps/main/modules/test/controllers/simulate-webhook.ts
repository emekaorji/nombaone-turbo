import { AppError } from '@nombaone/errors';
import { simulateWebhookEvent } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { WebhookSimulationResponseData } from '@nombaone/core-contracts/types';
import type { SimulateWebhookBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/sandbox/webhooks/simulate — emit a real catalog event and deliver it
 * through the real signed path (test deployments only), so a developer can verify
 * their endpoint against a genuine delivery on demand.
 */
export const simulateWebhookController: RequestHandler =
  jsonHandler<WebhookSimulationResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as SimulateWebhookBody;
    const result = await simulateWebhookEvent(db, ctx, { type: body.type, payload: body.payload });
    return {
      data: {
        domain: 'webhook_simulation',
        event: result.event,
        type: result.type,
        deliveredCount: result.deliveredCount,
      },
      statusCode: 201,
    };
  });
