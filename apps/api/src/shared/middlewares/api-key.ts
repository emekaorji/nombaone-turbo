import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { verifyApiKey } from '@nombaone/sara/api-keys';

import { db } from '../config/db';
import { env } from '../config/env';

import type { RequestHandler } from 'express';

/**
 * ── apiKeyAuth — the public-API authentication gate ────────────────────────
 *
 * The FIRST middleware in the per-route chain. It materialises `req.apiKey` from
 * a presented secret so every downstream guard (scope, rate-limit, idempotency,
 * handler) works off a TRUSTED principal, never client-supplied org/env.
 *
 * Two failure modes, both surfaced as the sara-minted AppError:
 *   • missing key          → 401 API_KEY_MISSING
 *   • malformed / unknown / revoked → 401 API_KEY_INVALID (from sara)
 *   • env encoded in the key disagrees with the row → 401 API_KEY_ENVIRONMENT_MISMATCH
 *
 * On top of sara's checks we enforce a DEPLOYMENT-level guard: this process
 * serves exactly one `env.INFRA_ENVIRONMENT`. A key whose verified environment
 * does not match THIS deployment is rejected with API_KEY_ENVIRONMENT_MISMATCH —
 * a `live` key presented to a `test` host (or vice versa) never authenticates,
 * even if the key itself is internally consistent.
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

    // Deployment-level pin: the key's environment must match the env THIS host
    // serves. sara already rejected a key whose encoded prefix disagrees with its
    // row; this guards the orthogonal case of a valid key on the wrong host.
    if (verified.environment !== env.INFRA_ENVIRONMENT) {
      throw AppError.Unauthorized(
        'API key environment does not match this deployment',
        { keyEnvironment: verified.environment, deploymentEnvironment: env.INFRA_ENVIRONMENT },
        NOMBAONE_ERROR_CODES.API_KEY_ENVIRONMENT_MISMATCH
      );
    }

    req.apiKey = {
      apiKeyId: verified.apiKeyId,
      organizationId: verified.organizationId,
      environment: verified.environment,
      scopes: verified.scopes,
    };

    next();
  } catch (error) {
    next(error);
  }
};
