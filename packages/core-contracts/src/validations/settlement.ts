import { z } from 'zod';

export const listSettlementsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'settled', 'reconciled', 'failed', 'refunded']).optional(),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuery>;
