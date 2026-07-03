import { AppError } from '@nombaone/errors';
import { rotateWebhookSecret } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { RotatedWebhookSecretResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** POST /v1/webhooks/:id/rotate-secret — new secret returned ONCE. */
export const rotateWebhookSecretController: RequestHandler =
  jsonHandler<RotatedWebhookSecretResponseData>(async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
    const { reference, signingSecret, signingSecretPrefix } = await rotateWebhookSecret(
      db, ctx, req.params.id ?? ''
    );
    return { data: { domain: 'webhook_secret', id: reference, signingSecret, signingSecretPrefix } };
  });
