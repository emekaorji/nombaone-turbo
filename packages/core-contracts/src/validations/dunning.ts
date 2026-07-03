import { z } from 'zod';

/**
 * Drive a mid-dunning card update (D10/E6). Either point at an already-captured
 * `payment_methods` row, or supply a fresh hosted-checkout token to attach + swap
 * atomically — exactly one (XOR).
 */
export const updateSubscriptionCardBody = z
  .object({
    paymentMethodReference: z.string().optional(),
    checkoutToken: z.string().optional(),
  })
  .refine((d) => (d.paymentMethodReference == null) !== (d.checkoutToken == null), {
    message: 'provide exactly one of paymentMethodReference or checkoutToken',
  });
export type UpdateSubscriptionCardBody = z.infer<typeof updateSubscriptionCardBody>;

export const listDunningAttemptsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListDunningAttemptsQuery = z.infer<typeof listDunningAttemptsQuery>;
