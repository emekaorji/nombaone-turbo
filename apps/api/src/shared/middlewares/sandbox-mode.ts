import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { RequestHandler } from 'express';

/**
 * Gate the `/v1/sandbox/*` test instruments to SANDBOX-mode keys only. ONE process
 * serves both modes, so these routes are always mounted; this middleware — placed
 * right after `apiKeyAuth`, so `req.apiKey.mode` is set — refuses a `live` key,
 * because the test clock / synthetic methods / webhook simulator must never touch
 * live money. (The individual handlers also re-check `ctx.mode` as defence in depth.)
 */
export const requireSandboxMode: RequestHandler = (req, _res, next) => {
  if (req.apiKey?.mode !== 'sandbox') {
    next(
      AppError.Forbidden(
        'Sandbox instruments are only available to sandbox-mode API keys',
        undefined,
        NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN
      )
    );
    return;
  }
  next();
};
