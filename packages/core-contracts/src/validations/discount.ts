import { z } from 'zod';

/** Apply a coupon to the route's target (customer or subscription, from `:reference`). */
export const applyDiscountBody = z.object({
  /** A coupon reference (`nbo…cpn`) or its tenant-facing `code`. */
  coupon: z.string().min(1),
});
export type ApplyDiscountBody = z.infer<typeof applyDiscountBody>;
