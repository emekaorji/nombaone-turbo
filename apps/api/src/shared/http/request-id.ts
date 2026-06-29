import { randomBytes } from 'node:crypto';

import type { RequestHandler } from 'express';

/** Generates a `req_…` id, exposes it as `X-Request-Id` and on `req.requestId`
 * (which the envelope echoes as `meta.requestId`). */
export const requestId: RequestHandler = (req, res, next) => {
  const id = `req_${randomBytes(16).toString('base64url')}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
