import { z } from 'zod';

/** PRICE input schemas. A create needs only `{ unitAmount, interval }`; every
 * other field has a safe default (L5). Money is positive integer kobo. */
export const createPriceBody = z.object({
  unitAmountInKobo: z.coerce.number().int().positive(), // kobo
  interval: z.enum(['day', 'week', 'month', 'year']),
  intervalCount: z.coerce.number().int().positive().default(1),
  usageType: z.enum(['licensed', 'metered']).default('licensed'),
  billingScheme: z.enum(['per_unit', 'tiered']).default('per_unit'),
  trialPeriodDays: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePriceBody = z.infer<typeof createPriceBody>;

export const listPriceQuery = z.object({
  planRef: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListPriceQuery = z.infer<typeof listPriceQuery>;
