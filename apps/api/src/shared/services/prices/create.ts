import { pricesTable, type PlanRow, type PriceInsert } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { assertPositiveKobo } from '@nombaone/sara/money';
import { resolvePlanId } from '../plans/queries';
import { mintReference } from '@nombaone/sara/reference';
import { serializePrice } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CreatePriceInput, EmbeddedPriceInput, PriceResponseData } from './types';

/**
 * The price guards that need NOTHING from the database — money + the 05 seam. They
 * run first (and, on the embedded `POST /v1/plans` path, before any transaction is
 * opened) so a bad price is rejected without a write to roll back.
 *
 * GUARD ORDER IS THE CONTRACT: kobo, then `tiered`. A tiered price against a plan
 * that does not exist has always answered `PRICE_TIERED_NOT_SUPPORTED`, not
 * `PLAN_NOT_FOUND`; reordering these would silently change that answer for clients.
 *
 * `index` locates the offending row when the price arrived inside an embedded
 * `prices: [...]` array. It is carried on `fieldErrors` — the only error surface
 * the wire actually exposes (`details` is server-side/logging only) — under the
 * same `prices.<i>.<field>` key zod itself would emit, so a merchant reads one
 * shape whether the rejection came from the schema or from here. Omitted entirely
 * on the single-price (nested route) path, where there is no array to point into.
 */
export function assertPriceCreatable(
  input: Pick<CreatePriceInput, 'unitAmount' | 'billingScheme'>,
  index?: number
): void {
  try {
    assertPositiveKobo(input.unitAmount);
  } catch (error) {
    if (index === undefined || !(error instanceof AppError)) throw error;
    throw AppError.UnprocessableEntity(
      error.message,
      { ...error.details, index },
      error.code,
      { [`prices.${index}.unitAmountInKobo`]: [error.message] }
    );
  }

  if (input.billingScheme === 'tiered') {
    // SEAM(05): tiered pricing lands with a `price_tiers` child table + a `tiers`
    // field on the serializer; reject until then rather than ship a half path.
    const message = 'tiered billing is not supported yet';
    throw AppError.BadRequest(
      message,
      { billingScheme: input.billingScheme, ...(index === undefined ? {} : { index }) },
      NOMBAONE_ERROR_CODES.PRICE_TIERED_NOT_SUPPORTED,
      index === undefined ? undefined : { [`prices.${index}.billingScheme`]: [message] }
    );
  }
}

/** An archived plan cannot take new prices (nothing new may subscribe to it). Only
 *  reachable from the nested route — a plan minted moments ago is always active. */
export function assertPlanAcceptsPrices(plan: PlanRow, planRef: string): void {
  if (plan.status === 'archived') {
    throw AppError.Conflict(
      'cannot add a price to an archived plan',
      { planRef },
      NOMBAONE_ERROR_CODES.PLAN_ALREADY_ARCHIVED
    );
  }
}

/** The price row a create writes. Shared by `createPrice` and `createPlanWithPrices`
 *  so a price born inside a plan create is byte-identical to one born on its own. */
export function buildPriceValues(
  ctx: DomainContext,
  input: EmbeddedPriceInput,
  planId: string,
  reference: string
): PriceInsert {
  return {
    reference,
    organizationId: ctx.organizationId,
    mode: ctx.mode,
    planId,
    unitAmount: input.unitAmount,
    interval: input.interval,
    intervalCount: input.intervalCount,
    usageType: input.usageType,
    billingScheme: input.billingScheme,
    trialPeriodDays: input.trialPeriodDays,
    metadata: input.metadata ?? {},
  };
}

/**
 * Create a price — i.e. mint a NEW version for a plan. This is the ONLY way a
 * price comes into being (alongside the embedded `prices: [...]` of a plan create,
 * which writes through the same builders); there is no money-edit path, which is
 * what makes price immutability hold (a "raise" is a new row + deactivating the
 * old, never an edit).
 *
 *  • `assertPriceCreatable` at the boundary (positive integer kobo; 05 seam).
 *  • `resolvePlanId` enforces tenant isolation in the WHERE clause (a plan not in
 *    scope simply does not exist → `PLAN_NOT_FOUND`); an archived plan cannot take
 *    new prices.
 */
export async function createPrice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreatePriceInput
): Promise<PriceResponseData> {
  assertPriceCreatable(input);

  const { id: planId, row: plan } = await resolvePlanId(txDb, ctx, input.planRef);

  assertPlanAcceptsPrices(plan, input.planRef);

  const reference = mintReference('PRC');

  const [row] = await txDb
    .insert(pricesTable)
    .values(buildPriceValues(ctx, input, planId, reference))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist price',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'price.created',
    payload: {
      reference,
      planRef: input.planRef,
      unitAmount: row.unitAmount,
      interval: row.interval,
      intervalCount: row.intervalCount,
    },
  });

  return serializePrice(row, input.planRef);
}
