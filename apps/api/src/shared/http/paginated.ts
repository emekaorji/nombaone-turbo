import { HTTP_STATUS_CODES } from '@nombaone/errors';

import type { ApiPaginated } from '@nombaone/core-contracts/types';
import type { Request, RequestHandler, Response } from 'express';

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  statusCode?: number;
}

/** Generic list handler factory → the paginated envelope (cursor pagination only:
 * opaque cursor, clamped limit, no total count). */
export const paginatedHandler =
  <T>(
    fn: (req: Request, res: Response) => Promise<PaginatedResult<T>> | PaginatedResult<T>
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      const { data, nextCursor, hasMore, limit, statusCode = HTTP_STATUS_CODES.OK } = await fn(
        req,
        res
      );
      const body: ApiPaginated<T> = {
        success: true,
        statusCode,
        data,
        pagination: { limit, hasMore, nextCursor },
        meta: { requestId: req.requestId },
      };
      res.status(statusCode).json(body);
    } catch (error) {
      next(error);
    }
  };
