import { createHash } from 'node:crypto';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { nombaSignatureCandidates, verifyNombaSignature } from '@nombaone/sara/nomba';
import { enqueueInboundWebhook } from '@nombaone/queue';

import { env } from '@shared/config/env';
import { jsonHandler } from '@shared/http';
import { logger } from '@shared/observability/logger';

import type { RequestHandler } from 'express';

/**
 * ── Inbound Nomba webhook (Nomba → us) ─────────────────────────────────────
 *
 * FAST-ACK + VERIFY-THEN-DEFER: verify the HMAC over the EXACT raw bytes
 * (`req.rawBody`), then dedup + enqueue (jobId = the provider's event id) and
 * 200 immediately; the heavy work (re-verify, settle) runs in the worker.
 *
 * Nomba uses its OWN scheme (`verifyNombaSignature`, the `nomba-signature`
 * header, dedup on the payload `requestId`) — distinct from the generic
 * raw-body-hex path used for other providers and from the OUTBOUND
 * `verifyWebhookSignature` (our deliveries TO tenants).
 */

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

export const nombaWebhookController: RequestHandler = jsonHandler<{ received: true }>(async (req) => {
  const provider = 'nomba';
  const rawBody = req.rawBody;

  if (!rawBody || rawBody.length === 0) {
    throw AppError.BadRequest(
      'Missing request body',
      { provider },
      NOMBAONE_ERROR_CODES.WEBHOOK_RAW_BODY_MISSING
    );
  }

  // ── Nomba: its own signing scheme + requestId dedup key ──────────────────
  // ONE inbound endpoint serves BOTH modes (sandbox.api is a CNAME alias of api),
  // so we can't know the event's mode before verifying — try every configured
  // mode key and accept on any match. The worker resolves the real mode later by
  // reference lookup; this gate only proves the bytes came from OUR Nomba.
  const keys = [env.NOMBA_LIVE_WEBHOOK_SIGNATURE_KEY, env.NOMBA_SANDBOX_WEBHOOK_SIGNATURE_KEY].filter(
    (k): k is string => Boolean(k)
  );
  if (keys.length === 0) {
    logger.error(`[webhook] ${req.requestId} no NOMBA_*_WEBHOOK_SIGNATURE_KEY set; rejecting nomba`);
    rejectSignature(provider);
  }
  const parsed = (req.body ?? {}) as Record<string, unknown>;
  const signature = headerValue(req.headers['nomba-signature']);
  const timestamp = headerValue(req.headers['nomba-timestamp']) ?? undefined;
  const body = rawBody.toString('utf8');

  if (env.NOMBA_WEBHOOK_DEBUG) {
    // T0 byte-confirm: log the REAL headers + raw body + every candidate signature
    // (per key) so the exact scheme can be pinned, and DO NOT reject on mismatch
    // while the scheme is still being confirmed. (env guard forbids this in prod.)
    logger.warn(`[webhook][T0] nomba headers=${JSON.stringify(req.headers)}`);
    logger.warn(`[webhook][T0] nomba rawBody(b64)=${rawBody.toString('base64')}`);
    logger.warn(`[webhook][T0] nomba-signature(header)=${signature ?? '(none)'}`);
    for (const key of keys) {
      logger.warn(
        `[webhook][T0] candidates=${JSON.stringify(
          nombaSignatureCandidates(key, body, parsed, timestamp)
        )}`
      );
    }
  } else if (
    !signature ||
    !keys.some((key) => verifyNombaSignature(key, signature, body, parsed, timestamp))
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
});
