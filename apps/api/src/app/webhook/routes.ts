import { createHash } from 'node:crypto';
import { Router } from 'express';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { nombaSignatureCandidates, verifyNombaSignature } from '@nombaone/sara/nomba';
import { verifyWebhookSignature } from '@nombaone/sara/webhooks';
import { enqueueInboundWebhook } from '@nombaone/queue';

import { env } from '../../shared/config/env';
import { jsonHandler } from '../../shared/http';
import { logger } from '../../shared/observability/logger';

/**
 * ── Inbound provider webhooks (provider → us) ──────────────────────────────
 *
 * FAST-ACK + VERIFY-THEN-DEFER: verify the HMAC over the EXACT raw bytes
 * (`req.rawBody`), then dedup + enqueue (jobId = the provider's event id) and
 * 200 immediately; the heavy work (re-verify, settle) runs in the worker.
 *
 * The `nomba` provider uses its OWN scheme (`verifyNombaSignature`, the
 * `nomba-signature` header, dedup on the payload `requestId`) — distinct from the
 * generic raw-body-hex path used for other providers and from the OUTBOUND
 * `verifyWebhookSignature` (our deliveries TO tenants).
 */
export const webhookRouter: Router = Router();

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

    // ── Nomba: its own signing scheme + requestId dedup key ──────────────────
    if (provider === 'nomba') {
      const key = env.NOMBA_WEBHOOK_SIGNATURE_KEY;
      if (!key) {
        logger.error(
          `[webhook] ${req.requestId} NOMBA_WEBHOOK_SIGNATURE_KEY unset; rejecting nomba`
        );
        rejectSignature(provider);
      }
      const parsed = (req.body ?? {}) as Record<string, unknown>;
      const signature = headerValue(req.headers['nomba-signature']);

      if (env.NOMBA_WEBHOOK_DEBUG) {
        // T0 byte-confirm: log the REAL headers + raw body + every candidate signature
        // so the exact scheme can be pinned, and DO NOT reject on mismatch while the
        // scheme is still being confirmed. (env guard forbids this in the live ring.)
        logger.warn(`[webhook][T0] nomba headers=${JSON.stringify(req.headers)}`);
        logger.warn(`[webhook][T0] nomba rawBody(b64)=${rawBody.toString('base64')}`);
        logger.warn(`[webhook][T0] nomba-signature(header)=${signature ?? '(none)'}`);
        logger.warn(
          `[webhook][T0] candidates=${JSON.stringify(
            nombaSignatureCandidates(
              key as string,
              rawBody.toString('utf8'),
              parsed,
              headerValue(req.headers['nomba-timestamp']) ?? undefined
            )
          )}`
        );
      } else if (
        !signature ||
        !verifyNombaSignature(key as string, signature, rawBody.toString('utf8'), parsed)
      ) {
        rejectSignature(provider);
      }

      const eventType = typeof parsed.event_type === 'string' ? parsed.event_type : 'unknown';
      const providerEventId =
        (typeof parsed.requestId === 'string' && parsed.requestId) ||
        `nomba_${createHash('sha256').update(rawBody).digest('hex')}`;

      await enqueueInboundWebhook({
        provider,
        providerEventId,
        eventType,
        payload: parsed,
        signature,
        receivedAt: new Date().toISOString(),
      });

      return { data: { received: true as const } };
    }

    // ── Generic providers: raw-body-hex against INFRA_WEBHOOK_SECRET ──────────
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
