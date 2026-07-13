import { z } from 'zod';

export const listSettlementsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'settled', 'reconciled', 'failed', 'refunded']).optional(),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuery>;

/** Refund a settlement's tenant share (default = full remaining refundable). */
export const refundSettlementBody = z.object({
  amountInKobo: z.number().int().positive().optional(),
});
export type RefundSettlementBody = z.infer<typeof refundSettlementBody>;

/**
 * Tenant-level withdrawal of settled funds, honouring the escrow lock.
 *
 * 🔒 There is deliberately NO destination in this body. It used to take a free-text
 * `bankCode` + `accountNumber`, which meant anyone holding an API key could push the
 * merchant's whole balance to any NUBAN they liked. The destination is now read from the
 * merchant's registered, bank-verified payout account (`POST /v1/payout-accounts`), so a
 * withdrawal can only ever go where the merchant already proved they own.
 *
 * Omit `amountInKobo` to withdraw everything available.
 */
export const createPayoutBody = z.object({
  amountInKobo: z.number().int().positive().optional(),
});
export type CreatePayoutBody = z.infer<typeof createPayoutBody>;

/**
 * Register the bank account a merchant is paid into. The holder's NAME is deliberately
 * absent: we get it from the bank (NIBSS name enquiry) and never from the caller — which
 * is what makes an unverified destination impossible to store.
 */
export const addPayoutAccountBody = z.object({
  bankCode: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().regex(/^\d{10}$/, 'a Nigerian NUBAN is exactly 10 digits'),
});
export type AddPayoutAccountBody = z.infer<typeof addPayoutAccountBody>;
