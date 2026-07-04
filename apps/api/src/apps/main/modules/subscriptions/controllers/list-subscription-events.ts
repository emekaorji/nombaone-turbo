import { AppError } from '@nombaone/errors';
import { listSubscriptionAuditTrail } from '@nombaone/sara/events';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { DomainEventResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:id/events — the subscription's audit trail (M). */
export const listSubscriptionEventsController: RequestHandler = jsonHandler<DomainEventResponseData[]>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
    return { data: await listSubscriptionAuditTrail(db, ctx, req.params.id ?? '') };
  }
);
