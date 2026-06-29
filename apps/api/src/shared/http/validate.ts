import { ZodError, type ZodTypeAny } from 'zod';

import { AppError, NOMBAONE_ERROR_CODES, type ApiFieldErrors } from '@nombaone/errors';

import type { RequestHandler } from 'express';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const toFieldErrors = (error: ZodError): ApiFieldErrors => {
  const fields: ApiFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
};

/**
 * Validate body/query/params against zod in one call. Coercion happens inside
 * the schema so handlers receive already-typed input. Emits a structured
 * `fields[]` map on failure, never a flat string.
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      // Express query/params are getters; shadow them with the coerced values.
      if (schemas.query) req.query = schemas.query.parse(req.query) as never;
      if (schemas.params) req.params = schemas.params.parse(req.params) as never;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          AppError.UnprocessableEntity(
            'Validation failed',
            undefined,
            NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
            toFieldErrors(error)
          )
        );
        return;
      }
      next(error);
    }
  };
