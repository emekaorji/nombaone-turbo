import { z } from 'zod';

export const scheduleChangeBody = z.object({
  priceId: z.string(),
  quantity: z.coerce.number().int().min(1).optional(),
  // `as const` enum so future modes (e.g. a specific date / period index) are
  // additive rather than a breaking change.
  effectiveAt: z.enum(['next_cycle']).default('next_cycle'),
});
export type ScheduleChangeBody = z.infer<typeof scheduleChangeBody>;
