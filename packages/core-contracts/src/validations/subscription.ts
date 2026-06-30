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

export const createSubscriptionBody = z
  .object({
    customerId: z.string(),
    priceId: z.string(),
    paymentMethodId: z.string().optional(),
    collectionMethod: z.enum(['charge_automatically', 'send_invoice']).default('charge_automatically'),
    trialDays: z.coerce.number().int().min(0).optional(),
    quantity: z.coerce.number().int().min(1).default(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  // `charge_automatically` needs a payment method UNLESS a trial is requested
  // (the first charge is deferred to trial end).
  .refine(
    (d) =>
      d.collectionMethod !== 'charge_automatically' ||
      Boolean(d.paymentMethodId) ||
      (d.trialDays ?? 0) > 0,
    { message: 'a payment method is required unless a trial is requested', path: ['paymentMethodId'] }
  );
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
