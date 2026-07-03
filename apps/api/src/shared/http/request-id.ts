import { randomBytes } from 'node:crypto';

import { runWithCorrelation } from '@shared/observability/correlation';

import type { RequestHandler } from 'express';

/** Generates a `req_…` id, exposes it as `X-Request-Id` and on `req.requestId`
 * (which the envelope echoes as `meta.requestId`), and opens the correlation
 * context so every downstream log line (through all awaits) carries this id as
 * `correlationId`. `apiKeyAuth` later fills in the tenant. */
export const requestId: RequestHandler = (req, res, next) => {
  const id = `req_${randomBytes(16).toString('base64url')}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  runWithCorrelation({ correlationId: id }, () => next());
};
