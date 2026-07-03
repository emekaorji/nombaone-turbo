import { and, eq } from 'drizzle-orm';

import { domainEventsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { serializeDomainEvent } from '@nombaone/sara/events';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainEventResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/events/:id. */
export const getEventController: RequestHandler = jsonHandler<DomainEventResponseData>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
  const [row] = await db
    .select()
    .from(domainEventsTable)
    .where(
      and(
        eq(domainEventsTable.reference, req.params.id ?? ''),
        eq(domainEventsTable.organizationId, ctx.organizationId),
        eq(domainEventsTable.environment, ctx.environment)
      )
    )
    .limit(1);
  if (!row) throw AppError.NotFound('Event not found', { reference: req.params.id }, NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR);
  return { data: serializeDomainEvent(row) };
});
