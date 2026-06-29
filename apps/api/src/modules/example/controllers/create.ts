import { AppError } from '@nombaone/errors';
import { createExample } from '@nombaone/sara/example';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { CreateExampleBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/examples — create an example (the money-path write).
 *
 * The controller is deliberately tiny: it derives the pinned `ctx` from the
 * VERIFIED api key (never from the client), hands the already-validated body to
 * sara, and returns the serialized resource. All business logic lives in
 * `createExample`; this layer only maps HTTP ⇄ domain.
 */
export const createExampleController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof createExample>>
>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const body = req.body as CreateExampleBody;

    const example = await createExample(db, ctx, { kind: body.kind, amount: body.amount });

    return { data: example, statusCode: 201 };
  }
);
