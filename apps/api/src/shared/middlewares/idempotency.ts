import { AppError, HTTP_STATUS_CODES, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { createIdempotencyStore, hashRequest } from '@nombaone/sara/idempotency';

import { redis } from '../config/redis';
import { logger } from '../observability/logger';

import type { ApiSuccess } from '@nombaone/core-contracts/types';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * ── idempotency — make a mutating POST safe to retry ───────────────────────
 *
 * Applied to MUTATING POSTs only. The client supplies `Idempotency-Key`; this
 * middleware drives sara's Redis-backed state machine (begin → complete / abort):
 *
 *   • proceed     → claim won; wrap `res.json` so the INNER `data` is cached on
 *                   first success, then run the handler.
 *   • replay      → re-serve the cached inner data verbatim (no re-execution).
 *   • in_progress → 409 IDEMPOTENCY_IN_PROGRESS (a concurrent request holds it).
 *   • mismatch    → 422 IDEMPOTENCY_KEY_REUSED (same key, different body).
 *
 * We cache only the inner domain `data`, never the HTTP envelope — the replay
 * re-wraps with THIS request's `meta.requestId`. The lock is released (abort) on
 * any non-2xx outcome so a failed write stays retryable.
 *
 * FAIL-OPEN: if Redis is unreachable, idempotency degrades to a normal request
 * rather than rejecting writes. A signed-up tenant must be able to transact even
 * when the dedup store blips; at-least-once with a brief dup window beats a hard
 * outage. The trade-off is logged so the blip is visible.
 *
 * Scope: the Redis key is namespaced by (org, env) so two tenants reusing the
 * same client-chosen key never collide.
 */

const store = createIdempotencyStore(redis);

/** A response is a cacheable success only on a 2xx with a success envelope. */
const isCacheableSuccess = (res: Response, body: unknown): body is ApiSuccess<unknown> =>
  res.statusCode >= 200 &&
  res.statusCode < 300 &&
  typeof body === 'object' &&
  body !== null &&
  (body as { success?: unknown }).success === true;

async function runIdempotency(
  req: Request,
  res: Response,
  next: NextFunction,
  required: boolean
): Promise<void> {
  // Only mutating POSTs participate. Anything else flows straight through.
  if (req.method !== 'POST') {
    next();
    return;
  }

  const headerKey = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;

  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    // REQUIRED endpoints (money movement / charges): a missing key is a 400 — a
    // retried charge without a key could double-move money. OPTIONAL endpoints
    // proceed as a normal (non-deduped) request when no key is supplied.
    if (required) {
      next(
        AppError.BadRequest(
          'Idempotency-Key header is required for this request',
          undefined,
          NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_MISSING
        )
      );
      return;
    }
    next();
    return;
  }

  // Namespace by the authenticated principal so keys never collide across tenants
  // or environments. `req.apiKey` is guaranteed by the upstream auth middleware.
  const scope = req.apiKey
    ? `${req.apiKey.organizationId}:${req.apiKey.mode}`
    : 'anonymous';
  const namespacedKey = `${scope}:${idempotencyKey.trim()}`;
  const requestHash = hashRequest({ path: req.path, body: req.body });

  let begun: Awaited<ReturnType<typeof store.begin>> | null = null;
  try {
    begun = await store.begin(namespacedKey, requestHash);
  } catch (error) {
    // FAIL-OPEN: dedup store down → proceed as a normal (non-idempotent) request.
    logger.warn(`[api] ${req.requestId} idempotency store unavailable; failing open`, {
      error: error instanceof Error ? error.message : String(error),
    });
    next();
    return;
  }

  switch (begun.state) {
    case 'replay': {
      // Re-serve the cached INNER data, re-wrapped with this request's metadata.
      const body: ApiSuccess<unknown> = {
        success: true,
        statusCode: HTTP_STATUS_CODES.OK,
        data: begun.data,
        meta: { requestId: req.requestId },
      };
      res.status(HTTP_STATUS_CODES.OK).json(body);
      return;
    }
    case 'in_progress':
      next(
        AppError.Conflict(
          'A request with this Idempotency-Key is already in progress',
          undefined,
          NOMBAONE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS
        )
      );
      return;
    case 'mismatch':
      next(
        AppError.UnprocessableEntity(
          'Idempotency-Key was reused with a different request',
          undefined,
          NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_REUSED
        )
      );
      return;
    case 'proceed':
    default:
      break;
  }

  // We won the claim. Hook `res.json` so we cache the inner data on the way out.
  const originalJson = res.json.bind(res);
  let settled = false;

  const finalize = (action: () => Promise<void>): void => {
    if (settled) return;
    settled = true;
    // Fire-and-forget: the response is already (being) sent; a store write that
    // fails must not break the response. Log and move on.
    action().catch((error) => {
      logger.warn(`[api] ${req.requestId} idempotency finalize failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  res.json = (body: unknown) => {
    if (isCacheableSuccess(res, body)) {
      finalize(() => store.complete(namespacedKey, body.data));
    } else {
      // Non-2xx / non-success → release the lock so the client may retry.
      finalize(() => store.abort(namespacedKey));
    }
    return originalJson(body);
  };

  // If the response finishes without a JSON body (e.g. a thrown error that the
  // error handler renders, or a closed connection), release the lock.
  res.on('finish', () => {
    finalize(() => store.abort(namespacedKey));
  });
  res.on('close', () => {
    finalize(() => store.abort(namespacedKey));
  });

  next();
}

/**
 * REQUIRED — money-movement & charge endpoints. A missing `Idempotency-Key` is a
 * 400: a retried charge without a key could double-move money.
 */
export const idempotency: RequestHandler = (req, res, next) =>
  runIdempotency(req, res, next, true);

/**
 * OPTIONAL (strongly encouraged) — non-money mutations. Dedupes when a key is
 * present; without one it behaves as a normal request. Our SDKs auto-generate a
 * key, so idempotency is on by default even here.
 */
export const idempotencyOptional: RequestHandler = (req, res, next) =>
  runIdempotency(req, res, next, false);
