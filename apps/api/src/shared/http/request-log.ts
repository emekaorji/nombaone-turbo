import { requestLogsTable } from '@nombaone/core-db';

import { db } from '@shared/config/db';
import { logger } from '@shared/observability/logger';

import type { RequestHandler } from 'express';

/**
 * Persists one row per inbound `/v1` request for the console's Developers → Logs
 * surface. It records metadata (method, path, status, latency, request id, ip,
 * idempotency key) AND the JSON response body, so a merchant can inspect exactly
 * what the API returned and quote the request id to support.
 *
 * Safety contract — this must NEVER affect the request:
 *   • the body is captured by wrapping `res.json` (the single response choke
 *     point for /v1), recording the argument then delegating unchanged;
 *   • the DB write is fire-and-forget on `res.on('finish')`, after the bytes are
 *     flushed, wrapped in try/catch so a logging failure is swallowed;
 *   • the body is size-capped, and rows are pruned by the retention sweep.
 */

/** Response bodies larger than this are dropped in favour of a truncation marker. */
const MAX_BODY_BYTES = 16_384;

/** Only the public API is logged; health/readiness probes are frequent noise and skipped. */
function isLoggablePath(path: string): boolean {
  if (!path.startsWith('/v1')) return false;
  return path !== '/v1/health' && path !== '/v1/ready';
}

function capBody(body: unknown): Record<string, unknown> | null {
  if (body === null || body === undefined || typeof body !== 'object') return null;
  try {
    const json = JSON.stringify(body);
    if (json.length > MAX_BODY_BYTES) {
      return { _truncated: true, _bytes: json.length, _note: `Response body omitted (> ${MAX_BODY_BYTES} bytes).` };
    }
    return body as Record<string, unknown>;
  } catch {
    // Non-serializable (circular, BigInt, …) — record that we couldn't capture it.
    return { _unserializable: true };
  }
}

export const requestLog: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  // Capture the response body at the /v1 envelope choke point without altering it.
  let capturedBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    capturedBody = body;
    return originalJson(body);
  }) as typeof res.json;

  res.on('finish', () => {
    const path = (req.originalUrl || req.url).split('?')[0] ?? '';
    if (req.method === 'OPTIONS' || !isLoggablePath(path)) return;

    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.baseUrl || null;
    const idempotencyHeader = req.headers['idempotency-key'];
    const apiVersionHeader = req.headers['x-api-version'];

    void db
      .insert(requestLogsTable)
      .values({
        requestId: req.requestId,
        organizationId: req.apiKey?.organizationId ?? null,
        mode: req.apiKey?.mode ?? null,
        apiKeyId: req.apiKey?.apiKeyId ?? null,
        method: req.method,
        path,
        route,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip ?? null,
        idempotencyKey: (Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader) ?? null,
        apiVersion: (Array.isArray(apiVersionHeader) ? apiVersionHeader[0] : apiVersionHeader) ?? 'v1',
        responseBody: capBody(capturedBody),
      })
      .onConflictDoNothing({ target: requestLogsTable.requestId })
      .catch((err: unknown) => {
        logger.debug('request-log write failed', { err: err instanceof Error ? err.message : String(err) });
      });
  });

  next();
};
