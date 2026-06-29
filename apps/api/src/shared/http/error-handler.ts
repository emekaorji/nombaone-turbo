import {
  AppError,
  HTTP_STATUS_CODES,
  NOMBAONE_ERROR_CODES,
  getDefaultNombaoneErrorCodeForStatus,
  toPublicErrorCode,
} from '@nombaone/errors';

import { logger } from '../observability/logger';

import type { ApiError } from '@nombaone/core-contracts/types';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    success: false,
    statusCode: HTTP_STATUS_CODES.NOT_FOUND,
    error: {
      code: NOMBAONE_ERROR_CODES.CLIENT_ROUTE_NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
    },
    meta: { requestId: req.requestId },
  };
  res.status(HTTP_STATUS_CODES.NOT_FOUND).json(body);
};

/**
 * Central error handler. Maps internal→public codes (anything not public-safe
 * collapses to SYSTEM_INTERNAL_ERROR so nothing internal leaks). 5xx logs the
 * full stack; <5xx logs the code only.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = error instanceof AppError ? error : null;
  const status = appError?.status ?? HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  const internalCode = appError?.code ?? getDefaultNombaoneErrorCodeForStatus(status);
  const publicCode = toPublicErrorCode(internalCode);
  const tag = `[api] ${req.requestId} ${req.method} ${req.path} -> ${status} ${internalCode}`;

  if (status >= HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR) {
    logger.error(tag, { stack: error instanceof Error ? error.stack : String(error) });
  } else {
    logger.warn(tag);
  }

  const body: ApiError = {
    success: false,
    statusCode: status,
    error: {
      code: publicCode,
      message:
        publicCode === NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
          ? 'Internal server error'
          : (appError?.message ?? 'Request failed'),
      fields: appError?.fieldErrors,
    },
    meta: { requestId: req.requestId },
  };
  res.status(status).json(body);
};
