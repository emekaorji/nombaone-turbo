import type { Kobo } from '../money';

export interface DiscountLine {
  kind: 'discount';
  description: string;
  amount: Kobo; // signed negative
  sourceReference: string; // the discount reference
}

/**
 * Compute the explicit negative `discount` line on the post-proration subtotal
 * (J/L) — `percent_off` → `−floor(subtotal · pct / 100)`, `amount_off` →
 * `−min(amount_off, subtotal)`. ALWAYS clamped so the line never exceeds the
 * subtotal (no negative invoice). Returns null when the discount is zero. Pure.
 */
export function computeDiscountLine(
  subtotal: Kobo,
  coupon: { amountOff: number | null; percentOff: number | null },
  sourceReference: string,
  description = 'Discount'
): DiscountLine | null {
  if (subtotal <= 0) return null;
  let off = 0;
  if (coupon.percentOff != null) off = Math.floor((subtotal * coupon.percentOff) / 100);
  else if (coupon.amountOff != null) off = coupon.amountOff;
  off = Math.min(off, subtotal);
  if (off <= 0) return null;
  return { kind: 'discount', description, amount: -off, sourceReference };
}
