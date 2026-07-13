import { z } from 'zod';

const subscriptionStatus = z.enum([
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
]);

/**
 * A `charge_automatically` create WITHOUT a payment method is the HOSTED-CHECKOUT
 * entry (the common storefront flow): the subscription starts `incomplete`, its
 * first invoice is issued, and the response carries a Nomba `checkoutLink` the
 * merchant redirects their end user to. Payment on that page activates the sub
 * and (card) captures a reusable token for silent renewals. The old refine that
 * REQUIRED a payment method here is gone — it forbade the flow merchants
 * actually need on day one.
 */
export const createSubscriptionBody = z.object({
  customerId: z.string(),
  priceId: z.string(),
  paymentMethodId: z.string().optional(),
  collectionMethod: z.enum(['charge_automatically', 'send_invoice']).default('charge_automatically'),
  trialDays: z.coerce.number().int().min(0).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  /** Where the hosted checkout returns the end user after paying (hosted-checkout entry only). */
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSubscriptionBody = z.infer<typeof createSubscriptionBody>;

export const updateSubscriptionBody = z
  .object({
    defaultPaymentMethodId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'at least one field must be provided' });
export type UpdateSubscriptionBody = z.infer<typeof updateSubscriptionBody>;

export const cancelSubscriptionBody = z.object({
  mode: z.enum(['now', 'at_period_end']).default('now'),
  comment: z.string().max(500).optional(),
});
export type CancelSubscriptionBody = z.infer<typeof cancelSubscriptionBody>;

export const pauseSubscriptionBody = z.object({
  maxDays: z.coerce.number().int().positive().optional(),
});
export type PauseSubscriptionBody = z.infer<typeof pauseSubscriptionBody>;

export const resumeSubscriptionBody = z.object({});
export type ResumeSubscriptionBody = z.infer<typeof resumeSubscriptionBody>;

export const resubscribeBody = z.object({
  priceId: z.string().optional(),
  paymentMethodId: z.string().optional(),
});
export type ResubscribeBody = z.infer<typeof resubscribeBody>;

export const listSubscriptionQuery = z.object({
  customerId: z.string().optional(),
  status: subscriptionStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListSubscriptionQuery = z.infer<typeof listSubscriptionQuery>;
