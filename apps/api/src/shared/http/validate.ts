import { ZodError, type ZodTypeAny } from 'zod';

import { AppError, NOMBAONE_ERROR_CODES, type ApiFieldErrors } from '@nombaone/errors';

import type { RequestHandler } from 'express';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Well-known key the OpenAPI walker reads off the `validate` middleware to
 *  advertise the exact request shape the server enforces (item 1 — no drift). */
export const OPENAPI_SCHEMAS = Symbol.for('nombaone.openapi.schemas');

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
export const validate = (schemas: ValidationSchemas): RequestHandler => {
  const handler: RequestHandler = (req, _res, next) => {
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
  // Tag the middleware so the OpenAPI walker advertises the exact enforced shape.
  (handler as unknown as Record<symbol, unknown>)[OPENAPI_SCHEMAS] = schemas;
  return handler;
};
