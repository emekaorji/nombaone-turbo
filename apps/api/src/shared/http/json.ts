import { HTTP_STATUS_CODES } from '@nombaone/errors';

import type { ApiSuccess } from '@nombaone/core-contracts/types';
import type { Request, RequestHandler, Response } from 'express';

export interface JsonResult<T> {
  data: T;
  statusCode?: number;
}

/**
 * Generic single-resource handler factory. The handler returns `{ data,
 * statusCode? }`; this wraps it in the success envelope with `meta.requestId`.
 * Controllers stay tiny and never touch `res` directly.
 */
export const jsonHandler =
  <T>(fn: (req: Request, res: Response) => Promise<JsonResult<T>> | JsonResult<T>): RequestHandler =>
  async (req, res, next) => {
    try {
      const { data, statusCode = HTTP_STATUS_CODES.OK } = await fn(req, res);
      const body: ApiSuccess<T> = {
        success: true,
        statusCode,
        data,
        meta: { requestId: req.requestId },
      };
      res.status(statusCode).json(body);
    } catch (error) {
      next(error);
    }
  };
