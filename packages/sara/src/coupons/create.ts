import { and, eq } from 'drizzle-orm';

import { couponsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { mintReference } from '../reference';
import { serializeCoupon } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { CouponResponseData, CreateCouponInput } from './types';

/**
 * Create a coupon DEFINITION. Validates the XOR (amount vs percent off) and the
 * repeating-needs-cycles rule defensively; pre-checks the `code` for a clean 409
 * (the `unique(org, env, code)` index is the structural backstop). Emits
 * `coupon.created`.
 */
export async function createCoupon(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateCouponInput
): Promise<CouponResponseData> {
  if ((input.amountOff != null) === (input.percentOff != null)) {
    throw AppError.UnprocessableEntity(
      'exactly one of amountOff or percentOff must be set',
      {},
      NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION
    );
  }
  if (input.duration === 'repeating' && input.durationInCycles == null) {
    throw AppError.UnprocessableEntity(
      'durationInCycles is required for a repeating coupon',
      {},
      NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION
    );
  }

  const [existing] = await txDb
    .select({ id: couponsTable.id })
    .from(couponsTable)
    .where(
      and(
        eq(couponsTable.organizationId, ctx.organizationId),
        eq(couponsTable.mode, ctx.mode),
        eq(couponsTable.code, input.code)
      )
    )
    .limit(1);
  if (existing) {
    throw AppError.Conflict(
      'a coupon with this code already exists',
      { code: input.code },
      NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION
    );
  }

  const reference = mintReference('CPN');
  const [row] = await txDb
    .insert(couponsTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      code: input.code,
      duration: input.duration,
      amountOff: input.amountOff ?? null,
      percentOff: input.percentOff ?? null,
      durationInCycles: input.durationInCycles ?? null,
      redeemBy: input.redeemBy ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist coupon',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'coupon.created', payload: { reference, code: input.code } });
  return serializeCoupon(row);
}
