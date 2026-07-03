import { z } from 'zod';

export const grantCreditBody = z.object({
  amountInKobo: z.coerce.number().int().positive(), // kobo
  source: z.enum(['manual', 'goodwill']).default('manual'),
  sourceReference: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type GrantCreditBody = z.infer<typeof grantCreditBody>;

export const listCreditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListCreditQuery = z.infer<typeof listCreditQuery>;
