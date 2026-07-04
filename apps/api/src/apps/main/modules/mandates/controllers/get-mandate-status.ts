import { AppError } from '@nombaone/errors';
import { pollMandateActive } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';
import { getNombaClient } from '@shared/config/nomba';

import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * GET /v1/mandates/:id — poll + surface the mandate's status, promoting it
 * to `active` once `ACTIVE`+`ADVICE_SENT` (activation is poll-only — no webhook).
 */
export const getMandateStatusController: RequestHandler = jsonHandler<
  Awaited<ReturnType<typeof pollMandateActive>>
>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };

  const method = await pollMandateActive(getNombaClient(ctx.mode), db, ctx, {
    reference: req.params.id ?? '',
  });

  return { data: method };
});
