import { z } from 'zod';

export const listInvoiceQuery = z.object({
  customerId: z.string().optional(),
  subscriptionId: z.string().optional(),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListInvoiceQuery = z.infer<typeof listInvoiceQuery>;

export const voidInvoiceBody = z.object({
  comment: z.string().max(500).optional(),
});
export type VoidInvoiceBody = z.infer<typeof voidInvoiceBody>;
