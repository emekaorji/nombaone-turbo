import { eq } from 'drizzle-orm';

import { couponsTable } from '@nombaone/core-db/schema';

import { loadCouponRow } from './queries';
import { serializeCoupon } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { CouponResponseData, UpdateCouponInput } from './types';

/** Update mutable coupon fields (redeemBy / maxRedemptions / metadata). The
 *  definition (amount/percent off, duration) is immutable. */
export async function updateCoupon(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: UpdateCouponInput
): Promise<CouponResponseData> {
  const row = await loadCouponRow(txDb, ctx, reference);
  const set: { redeemBy?: Date; maxRedemptions?: number; metadata?: Record<string, unknown> } = {};
  if (input.redeemBy !== undefined) set.redeemBy = input.redeemBy;
  if (input.maxRedemptions !== undefined) set.maxRedemptions = input.maxRedemptions;
  if (input.metadata !== undefined) set.metadata = input.metadata;

  const [updated] = await txDb
    .update(couponsTable)
    .set(set)
    .where(eq(couponsTable.id, row.id))
    .returning();
  return serializeCoupon(updated ?? row);
}
