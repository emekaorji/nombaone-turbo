import { eq } from 'drizzle-orm';

import { couponsTable, discountsTable } from '@nombaone/core-db/schema';

import { computeDiscountLine, type DiscountLine } from './compute';
import { loadActiveDiscountForCustomer, loadActiveDiscountForSubscription } from './queries';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * Resolve the active discount for an invoice (subscription first, then customer),
 * compute its line on the post-proration `subtotal`, and CONSUME a cycle — a
 * `repeating` discount's `cycles_remaining` decrements and ends at 0; `forever`
 * (null) never decrements. Returns the explicit negative line, or null if no
 * discount applies (or it would be zero). The decrement happens only when a line is
 * actually produced.
 */
export async function resolveAndConsumeDiscount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { subscriptionId: string | null; customerId: string; subtotal: number }
): Promise<DiscountLine | null> {
  let discount = input.subscriptionId
    ? await loadActiveDiscountForSubscription(txDb, ctx, input.subscriptionId)
    : null;
  if (!discount) discount = await loadActiveDiscountForCustomer(txDb, ctx, input.customerId);
  if (!discount) return null;

  const [coupon] = await txDb
    .select({ amountOff: couponsTable.amountOff, percentOff: couponsTable.percentOff })
    .from(couponsTable)
    .where(eq(couponsTable.id, discount.couponId))
    .limit(1);
  if (!coupon) return null;

  const line = computeDiscountLine(input.subtotal, coupon, discount.reference);
  if (!line) return null;

  if (discount.cyclesRemaining != null) {
    const remaining = discount.cyclesRemaining - 1;
    await txDb
      .update(discountsTable)
      .set(remaining <= 0 ? { cyclesRemaining: 0, status: 'ended', endAt: new Date() } : { cyclesRemaining: remaining })
      .where(eq(discountsTable.id, discount.id));
  }
  return line;
}
