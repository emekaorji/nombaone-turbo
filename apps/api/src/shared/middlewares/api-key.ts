import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { verifyApiKey } from '@nombaone/sara/api-keys';

import { db } from '../config/db';
import { env } from '../config/env';
import { setCorrelationFields } from '../observability/correlation';

import type { RequestHandler } from 'express';

/**
 * ── apiKeyAuth — the public-API authentication gate ────────────────────────
 *
 * The FIRST middleware in the per-route chain. It materialises `req.apiKey` from
 * a presented secret so every downstream guard (scope, rate-limit, idempotency,
 * handler) works off a TRUSTED principal, never client-supplied org/env.
 *
 * Failure modes, surfaced as the sara-minted AppError:
 *   • missing key          → 401 API_KEY_MISSING
 *   • malformed / unknown / revoked → 401 API_KEY_INVALID (from sara)
 *   • mode encoded in the key disagrees with the row → 401 API_KEY_ENVIRONMENT_MISMATCH
 *
 * The key's `mode` (`sandbox`|`live`, from its prefix) is NOT pinned to the
 * deployment — ONE process serves BOTH modes and derives `ctx.mode` per request
 * from the key. The only deployment-level guard is a SAFETY one: a `live` key is
 * rejected on any non-`production` deployment, so a leaked live key still cannot
 * move real money from a laptop or CI box.
 */

/** Pull the raw secret from `Authorization: Bearer <key>` or `x-api-key`. */
const extractRawKey = (authorization: string | undefined, xApiKey: string | undefined): string | null => {
  if (authorization) {
    const [scheme, ...rest] = authorization.trim().split(/\s+/);
    if (scheme && scheme.toLowerCase() === 'bearer' && rest.length > 0) {
      return rest.join(' ').trim() || null;
    }
  }
  if (typeof xApiKey === 'string' && xApiKey.trim().length > 0) {
    return xApiKey.trim();
  }
  return null;
};

export const apiKeyAuth: RequestHandler = async (req, _res, next) => {
  try {
    const headerXApiKey = req.headers['x-api-key'];
    const rawKey = extractRawKey(
      req.headers.authorization,
      Array.isArray(headerXApiKey) ? headerXApiKey[0] : headerXApiKey
    );

    if (!rawKey) {
      throw AppError.Unauthorized(
        'API key required',
        undefined,
        NOMBAONE_ERROR_CODES.API_KEY_MISSING
      );
    }

    const verified = await verifyApiKey(db, rawKey);

    // SAFETY guard (not a deployment pin): a `live` key is only honoured on a
    // `production` deployment. A non-production box (laptop, CI) cannot mint a live
    // Nomba client anyway (getNombaClient guards it), so refuse the key up front —
    // a leaked live key never authenticates off production. `sandbox` keys work on
    // every deployment; ONE process serves both modes via `ctx.mode`.
    if (verified.mode === 'live' && env.INFRA_ENVIRONMENT !== 'production') {
      throw AppError.Unauthorized(
        'Live API keys are only accepted on a production deployment',
        { keyMode: verified.mode, deploymentEnvironment: env.INFRA_ENVIRONMENT },
        NOMBAONE_ERROR_CODES.API_KEY_ENVIRONMENT_MISMATCH
      );
    }

    req.apiKey = {
      apiKeyId: verified.apiKeyId,
      organizationId: verified.organizationId,
      mode: verified.mode,
      scopes: verified.scopes,
    };

    // Fill the tenant into the ambient correlation context so every downstream
    // log line (request + any work it drives) is filterable by tenant.
    setCorrelationFields({
      organizationId: verified.organizationId,
      mode: verified.mode,
    });

    next();
  } catch (error) {
    next(error);
  }
};
