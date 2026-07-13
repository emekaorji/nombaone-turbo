import { z } from 'zod';

/**
 * Drive a mid-dunning card update (D10/E6) by pointing at an already-captured
 * `payment_methods` row. There is deliberately NO raw-token field: the old
 * `checkoutToken` path wrote an arbitrary caller-supplied string verbatim into
 * `token_key` and made it an active default card — i.e. an unverified string
 * became a chargeable credential. Fresh cards must be captured through the
 * hosted checkout (which attaches the `payment_methods` row server-side from
 * the provider webhook); this endpoint only promotes captured rows.
 */
export const updateSubscriptionCardBody = z.object({
  paymentMethodReference: z.string().min(1),
});
export type UpdateSubscriptionCardBody = z.infer<typeof updateSubscriptionCardBody>;

export const listDunningAttemptsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListDunningAttemptsQuery = z.infer<typeof listDunningAttemptsQuery>;
