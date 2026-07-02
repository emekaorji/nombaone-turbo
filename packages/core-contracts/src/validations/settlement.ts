import { z } from 'zod';

export const listSettlementsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'settled', 'reconciled', 'failed', 'refunded']).optional(),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuery>;

/** Refund a settlement's tenant share (default = full remaining refundable). */
export const refundSettlementBody = z.object({
  amountKobo: z.number().int().positive().optional(),
});
export type RefundSettlementBody = z.infer<typeof refundSettlementBody>;

/** Tenant-level withdrawal of settled funds, honouring the escrow lock. */
export const createPayoutBody = z.object({
  amountKobo: z.number().int().positive(),
  bankCode: z.string().min(1),
  accountNumber: z.string().min(1),
});
export type CreatePayoutBody = z.infer<typeof createPayoutBody>;
