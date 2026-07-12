import { AppError } from '@nombaone/errors';
import { requireScope } from '@nombaone/sara/api-keys';
import { createPlan, createPlanWithPrices } from '@shared/services/plans';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { CreatePlanBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { PlanWithPricesResponseData } from '@shared/services/plans';
import type { RequestHandler } from 'express';

/**
 * POST /v1/plans — create a plan, optionally WITH the prices it launches at
 * (`prices: [...]`, atomic: every row lands or none does).
 *
 * SCOPE ESCALATION GUARD. The route declares `plans:write` and `requireScope` gates
 * exactly one scope, so a `plans:write`-only key reaching this handler could mint
 * PRICE rows through the embedded array — a capability its key was never granted.
 * When (and only when) prices are embedded, the key must ALSO hold `prices:write`,
 * asserted here against the verified principal (never a client-supplied scope) and
 * BEFORE any DB work → `403 API_KEY_SCOPE_FORBIDDEN`. The route stack is unchanged:
 * we tightened the BODY, not the endpoint — `POST /v1/plans` with no prices still
 * needs only `plans:write`.
 *
 * `data.prices` is always present: the embedded rows in submission order, or `[]`.
 */
export const createPlanController: RequestHandler = jsonHandler<PlanWithPricesResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as CreatePlanBody;

    const embedded = body.prices ?? [];
    if (embedded.length > 0) {
      requireScope({ scopes: req.apiKey.scopes }, 'prices:write');
    }

    const plan = {
      name: body.name,
      description: body.description,
      metadata: body.metadata,
    };

    if (embedded.length === 0) {
      return { data: { ...(await createPlan(db, ctx, plan)), prices: [] }, statusCode: 201 };
    }

    const created = await createPlanWithPrices(db, ctx, {
      ...plan,
      prices: embedded.map((price) => ({
        unitAmount: price.unitAmountInKobo,
        interval: price.interval,
        intervalCount: price.intervalCount,
        usageType: price.usageType,
        billingScheme: price.billingScheme,
        trialPeriodDays: price.trialPeriodDays,
        metadata: price.metadata,
      })),
    });

    return { data: created, statusCode: 201 };
  }
);
