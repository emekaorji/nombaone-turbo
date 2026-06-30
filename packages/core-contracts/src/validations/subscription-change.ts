import { z } from 'zod';

/**
 * A proration-triggering change (distinct from 03's `updateSubscriptionBody`, which
 * only edits metadata / default payment method). A price swap, interval switch, or
 * quantity change runs the proration engine; `proration_behavior: 'none'` opts out.
 */
export const changeSubscriptionBody = z
  .object({
    priceId: z.string().optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    intervalSwitch: z.boolean().optional(),
    prorationBehavior: z.enum(['create_prorations', 'none']).default('create_prorations'),
  })
  .refine((d) => d.priceId != null || d.quantity != null || d.intervalSwitch != null, {
    message: 'at least one of priceId, quantity, or intervalSwitch must be provided',
  });
export type ChangeSubscriptionBody = z.infer<typeof changeSubscriptionBody>;
