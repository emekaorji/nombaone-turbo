import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { verifyApiKey } from '@nombaone/sara/api-keys';

import { db } from '../config/db';
import { env } from '../config/env';
import { setCorrelationFields } from '../observability/correlation';

import type { Mode } from '@nombaone/sara/context';
import type { Request, RequestHandler } from 'express';

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
 * from the key. Two guards on top:
 *   • SAFETY: a `live` key is rejected on any non-`production` deployment, so a
 *     leaked live key can't move real money from a laptop or CI box.
 *   • DX (host guard): on a recognised production host the key's mode must match
 *     the host — a `nbo_sandbox_` key on the live host (or vice-versa) is refused
 *     with a message that names both sides, so a wrong-URL mistake is obvious.
 */

/**
 * Client-facing hostnames for THIS request. `req.hostname` honours `trust proxy`;
 * `X-Forwarded-Host`/`Host` are also checked so the guard fires whichever the proxy
 * chain (Cloudflare → DigitalOcean) populates. Ports stripped, lower-cased, de-duped.
 */
const requestHosts = (req: Request): string[] => {
  const out = new Set<string>();
  const add = (value: string | string[] | undefined): void => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return;
    for (const part of raw.split(',')) {
      const host = part.trim().split(':')[0]?.toLowerCase();
      if (host) out.add(host);
    }
  };
  add(req.hostname);
  add(req.headers['x-forwarded-host']);
  add(req.headers.host);
  return [...out];
};

/**
 * The mode a request's host REQUIRES, or `null` when the host is not a recognised
 * production host (localhost, tunnels, DO-internal, tests) — in which case the host
 * guard does not apply (fail-open: it never locks out non-production traffic).
 */
const expectedModeForHost = (req: Request): Mode | null => {
  const hosts = requestHosts(req);
  const sandboxHost = env.INFRA_SANDBOX_API_HOST.toLowerCase();
  const liveHost = env.INFRA_LIVE_API_HOST.toLowerCase();
  if (sandboxHost && hosts.includes(sandboxHost)) return 'sandbox';
  if (liveHost && hosts.includes(liveHost)) return 'live';
  return null;
};

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

    // DX host guard: on a recognised production host, the key's mode must match the
    // host. A wrong-URL mistake (a `nbo_sandbox_` key on the live host, or a
    // `nbo_live_` key on the sandbox host) is refused with a message naming both
    // sides + the exact fix. Unrecognised hosts (localhost, tunnels) are not enforced.
    const expectedMode = expectedModeForHost(req);
    if (expectedMode && verified.mode !== expectedMode) {
      const expectedHost =
        expectedMode === 'sandbox' ? env.INFRA_SANDBOX_API_HOST : env.INFRA_LIVE_API_HOST;
      const keyHost =
        verified.mode === 'sandbox' ? env.INFRA_SANDBOX_API_HOST : env.INFRA_LIVE_API_HOST;
      throw AppError.Unauthorized(
        `${req.hostname} only accepts ${expectedMode} keys, but a ${verified.mode} key (nbo_${verified.mode}_…) was presented. ` +
          `Send this key to ${keyHost}, or use an nbo_${expectedMode}_ key here on ${expectedHost}.`,
        { host: req.hostname, keyMode: verified.mode, expectedMode },
        NOMBAONE_ERROR_CODES.API_KEY_HOST_MISMATCH
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
