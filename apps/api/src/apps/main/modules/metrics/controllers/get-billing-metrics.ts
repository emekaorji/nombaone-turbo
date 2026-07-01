import { AppError } from '@nombaone/errors';
import { computeBillingMetrics } from '@nombaone/sara/metrics';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { BillingMetricsData } from '@nombaone/core-contracts/types';
import type { MetricsQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/** GET /v1/metrics/billing — the tenant's derived billing metrics (M ★). */
export const getBillingMetricsController: RequestHandler = jsonHandler<BillingMetricsData>(async (req) => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  const ctx: DomainContext = { organizationId: req.apiKey.organizationId, environment: req.apiKey.environment };
  const q = req.query as unknown as MetricsQuery;
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - THIRTY_DAYS_MS);
  return { data: await computeBillingMetrics(db, ctx, { from, to }) };
});
