import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { requireScope as assertScope } from '@nombaone/sara/api-keys';

import type { RequestHandler } from 'express';

/**
 * ── requireScope — per-endpoint authorization ──────────────────────────────
 *
 * Runs AFTER auth, so `req.apiKey` is already the verified principal. Each route
 * declares the single scope string it needs (e.g. `example:write`) and this
 * middleware delegates to sara's pure {@link assertScope} guard. The handler
 * never reads a scope from the client — only the set materialised by
 * `verifyApiKey`.
 *
 * A request that reaches here without `req.apiKey` is a wiring bug (scope was
 * mounted before auth); we fail closed with API_KEY_MISSING rather than crash.
 */
export const requireScope =
  (scope: string): RequestHandler =>
  (req, _res, next) => {
    try {
      if (!req.apiKey) {
        throw AppError.Unauthorized(
          'API key required',
          undefined,
          NOMBAONE_ERROR_CODES.API_KEY_MISSING
        );
      }
      assertScope({ scopes: req.apiKey.scopes }, scope);
      next();
    } catch (error) {
      next(error);
    }
  };
