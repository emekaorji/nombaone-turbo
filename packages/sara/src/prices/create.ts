import { pricesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { assertPositiveKobo } from '../money';
import { resolvePlanId } from '../plans/queries';
import { mintReference } from '../reference';
import { serializePrice } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreatePriceInput, PriceResponseData } from './types';

/**
 * Create a price — i.e. mint a NEW version for a plan. This is the ONLY way a
 * price comes into being; there is no money-edit path, which is what makes price
 * immutability hold (a "raise" is a new row + deactivating the old, never an edit).
 *
 *  • `assertPositiveKobo` at the boundary (positive integer kobo).
 *  • SEAM(05): `tiered` billing is reserved — rejected here until 05 builds the
 *    `price_tiers` child table + the serializer's `tiers` field.
 *  • `resolvePlanId` enforces tenant isolation in the WHERE clause (a plan not in
 *    scope simply does not exist → `PLAN_NOT_FOUND`); an archived plan cannot take
 *    new prices.
 */
export async function createPrice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreatePriceInput
): Promise<PriceResponseData> {
  assertPositiveKobo(input.unitAmount);

  if (input.billingScheme === 'tiered') {
    // SEAM(05): tiered pricing lands with a `price_tiers` child table + a `tiers`
    // field on the serializer; reject until then rather than ship a half path.
    throw AppError.BadRequest(
      'tiered billing is not supported yet',
      { billingScheme: input.billingScheme },
      NOMBAONE_ERROR_CODES.PRICE_TIERED_NOT_SUPPORTED
    );
  }

  const { id: planId, row: plan } = await resolvePlanId(txDb, ctx, input.planRef);

  if (plan.status === 'archived') {
    throw AppError.Conflict(
      'cannot add a price to an archived plan',
      { planRef: input.planRef },
      NOMBAONE_ERROR_CODES.PLAN_ALREADY_ARCHIVED
    );
  }

  const reference = mintReference('PRC');

  const [row] = await txDb
    .insert(pricesTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      planId,
      unitAmount: input.unitAmount,
      interval: input.interval,
      intervalCount: input.intervalCount,
      usageType: input.usageType,
      billingScheme: input.billingScheme,
      trialPeriodDays: input.trialPeriodDays,
      metadata: input.metadata ?? {},
    })
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
