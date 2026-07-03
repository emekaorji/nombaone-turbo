import { createHash } from 'node:crypto';
import { Router } from 'express';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { verifyWebhookSignature } from '@nombaone/sara/webhooks';
import { enqueueInboundWebhook } from '@nombaone/queue';

import { env } from '@shared/config/env';
import { jsonHandler } from '@shared/http';
import { logger } from '@shared/observability/logger';
import { nombaWebhookRouter } from '@/apps/webhook/modules/nomba/routes';

/**
 * ── Inbound provider webhooks (provider → us) ──────────────────────────────
 *
 * FAST-ACK + VERIFY-THEN-DEFER: verify the HMAC over the EXACT raw bytes
 * (`req.rawBody`), then dedup + enqueue (jobId = the provider's event id) and
 * 200 immediately; the heavy work (re-verify, settle) runs in the worker.
 *
 * Each provider is a module mounted under `/v1` (so `nomba` → `/v1/nomba`). The
 * `nomba` provider uses its OWN scheme (see the nomba module). The generic
 * raw-body-hex path (`/v1/:provider`) covers other providers and is distinct
 * from the OUTBOUND `verifyWebhookSignature` (our deliveries TO tenants).
 */
export const webhookRouter: Router = Router();
const API_VERSION = '/v1';

/** Read a single header value (Express may hand back an array). */
const headerValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const rejectSignature = (provider: string): never => {
  throw AppError.Unauthorized(
    'Webhook signature verification failed',
    { provider },
    NOMBAONE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID
  );
};

// ── Generic providers: raw-body-hex against INFRA_WEBHOOK_SECRET ────────────
const genericWebhookRouter: Router = Router();
genericWebhookRouter.post(
  '/:provider',
  jsonHandler<{ received: true }>(async (req) => {
    const provider = req.params.provider ?? 'unknown';
    const rawBody = req.rawBody;

    if (!rawBody || rawBody.length === 0) {
      throw AppError.BadRequest(
        'Missing request body',
        { provider },
        NOMBAONE_ERROR_CODES.WEBHOOK_RAW_BODY_MISSING
      );
    }

    const secret = env.INFRA_WEBHOOK_SECRET;
    if (!secret) {
      logger.error(`[webhook] ${req.requestId} INFRA_WEBHOOK_SECRET unset; rejecting ${provider}`);
      rejectSignature(provider);
    }

    const signature =
      headerValue(req.headers['x-nombaone-signature']) ??
      headerValue(req.headers['x-webhook-signature']) ??
      headerValue(req.headers['x-signature']);

    if (!signature || !verifyWebhookSignature(secret as string, rawBody.toString('utf8'), signature)) {
      rejectSignature(provider);
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventType = typeof body.type === 'string' ? body.type : 'unknown';
    const providerEventId =
      (typeof body.id === 'string' && body.id) ||
      (typeof body.eventId === 'string' && body.eventId) ||
      `${provider}_${createHash('sha256').update(rawBody).digest('hex')}`;

    await enqueueInboundWebhook({
      provider,
      providerEventId,
      eventType,
      payload: body,
      signature,
      receivedAt: new Date().toISOString(),
    });

    return { data: { received: true as const } };
  })
);

const allRoutes = Router();

// Per-provider modules. `nomba` first so `/v1/nomba` resolves to its own
// signing scheme; the generic catch-all covers every other provider.
allRoutes.use('/nomba', nombaWebhookRouter);
allRoutes.use('/', genericWebhookRouter);

// The version prefix is applied at exactly ONE place.
webhookRouter.use(API_VERSION, allRoutes);

export default webhookRouter;
