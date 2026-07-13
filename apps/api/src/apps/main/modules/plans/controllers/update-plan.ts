import { AppError } from '@nombaone/errors';
import { requireScope } from '@nombaone/sara/api-keys';
import {
  listActivePlanPrices,
  resolvePlanId,
  updatePlan,
  updatePlanWithPrices,
} from '@shared/services/plans';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { UpdatePlanBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { PlanWithPricesResponseData } from '@shared/services/plans';
import type { RequestHandler } from 'express';

/**
 * PATCH /v1/plans/:id — update a plan's descriptive fields, and optionally RECONCILE what it
 * costs (`prices: [...]`, atomically).
 *
 * A plan IS what it costs, so changing an amount is an edit to the plan — not a scavenger hunt
 * through its individual price rows. Send the cadences you want; each is created, left exactly
 * as it is, or replaced (a NEW price row, with the old one retired — a price is immutable,
 * which is what grandfathers the subscribers already paying it). A cadence you omit is
 * untouched, so a partial update can never silently retire a price.
 *
 * SCOPE ESCALATION GUARD, exactly as on `POST /v1/plans`. The route declares `plans:write` and
 * `requireScope` gates one scope, so a `plans:write`-only key reaching this handler could mint
 * and retire PRICE rows through the embedded array — a capability its key was never granted.
 * When (and only when) prices are present, the key must ALSO hold `prices:write`, asserted
 * against the verified principal BEFORE any DB work → `403 API_KEY_SCOPE_FORBIDDEN`. A PATCH
 * with no `prices` still needs only `plans:write`.
 *
 * `data.prices` is always present — the plan's ACTIVE prices after the update — so the response
 * shape does not depend on whether the caller happened to send any. Additive for existing
 * callers, who simply ignore it.
 */
export const updatePlanController: RequestHandler = jsonHandler<PlanWithPricesResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const body = req.body as UpdatePlanBody;
    const reference = req.params.id ?? '';

    const embedded = body.prices ?? [];
    if (embedded.length > 0) {
      requireScope({ scopes: req.apiKey.scopes }, 'prices:write');
    }

    const fields = {
      name: body.name,
      description: body.description,
      metadata: body.metadata,
    };

    if (embedded.length === 0) {
      const plan = await updatePlan(db, ctx, reference, fields);
      const { id } = await resolvePlanId(db, ctx, reference);
      return { data: { ...plan, prices: await listActivePlanPrices(db, ctx, id, reference) } };
    }

    const updated = await updatePlanWithPrices(db, ctx, reference, {
      ...fields,
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

    return { data: updated };
  }
);
