import { createHash } from 'node:crypto';
import { Router } from 'express';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { verifyWebhookSignature } from '@nombaone/sara/webhooks';
import { enqueueInboundWebhook } from '@nombaone/queue';

import { env } from '../../shared/config/env';
import { jsonHandler } from '../../shared/http';
import { logger } from '../../shared/observability/logger';

/**
 * ── Inbound provider webhooks (provider → us) ──────────────────────────────
 *
 * The generic edge for asynchronous settlement notifications. The discipline,
 * which mirrors the outbound side, is FAST-ACK + VERIFY-THEN-DEFER:
 *
 *   1. VERIFY the HMAC signature over the EXACT raw bytes (`req.rawBody`,
 *      captured by the sub-app's body parser) using a timing-safe compare. A
 *      re-serialized JSON body would not byte-match the provider's signature, so
 *      we never trust the parsed object for verification.
 *   2. DEDUP + ENQUEUE: hand the event to `inboundWebhookQueue` with
 *      jobId = a stable event id, so a provider's retries collapse onto ONE job
 *      (idempotent enqueue) and the heavy work (re-verify against the provider,
 *      ledger settlement) happens OUT OF BAND in the worker.
 *   3. ACK immediately with 200 so the provider does not time out and storm us
 *      with retries while we process.
 *
 * The webhook is an UNTRUSTED hint: a valid signature only proves authenticity,
 * not that money actually moved. The worker re-verifies against the provider
 * before recording anything (see sara `confirmExampleFromWebhook`).
 */
export const webhookRouter: Router = Router();

/** Read a single header value (Express may hand back an array). */
const headerValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

webhookRouter.post(
  '/inbound/:provider',
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
      // Misconfiguration, not a client fault — but surfaced as a signature
      // failure so we never reveal that verification is effectively disabled.
      logger.error(`[webhook] ${req.requestId} INFRA_WEBHOOK_SECRET unset; rejecting ${provider}`);
      throw AppError.Unauthorized(
        'Webhook signature verification failed',
        { provider },
        NOMBAONE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID
      );
    }

    // Providers send the signature under varying header names; accept the common
    // ones plus our own convention.
    const signature =
      headerValue(req.headers['x-nombaone-signature']) ??
      headerValue(req.headers['x-webhook-signature']) ??
      headerValue(req.headers['x-signature']);

    if (!signature || !verifyWebhookSignature(secret, rawBody.toString('utf8'), signature)) {
      throw AppError.Unauthorized(
        'Webhook signature verification failed',
        { provider },
        NOMBAONE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID
      );
    }

    // The parsed body is now safe to read (its bytes matched the signature).
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventType = typeof body.type === 'string' ? body.type : 'unknown';
    // Prefer the provider's own event id for dedup; fall back to a content hash
    // so a provider that omits an id still collapses identical redeliveries.
    const providerEventId =
      (typeof body.id === 'string' && body.id) ||
      (typeof body.eventId === 'string' && body.eventId) ||
      `${provider}_${createHash('sha256').update(rawBody).digest('hex')}`;

    // Idempotent enqueue: jobId = providerEventId, so retries map to one job.
    await enqueueInboundWebhook({
      provider,
      providerEventId,
      eventType,
      payload: body,
      signature,
      receivedAt: new Date().toISOString(),
    });

    // Fast-ack: 200 immediately; durable processing continues in the worker.
    return { data: { received: true as const } };
  })
);
