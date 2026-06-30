import { z } from 'zod';

/** PAYMENT METHOD / capture input schemas. Money is positive integer kobo. */
export const listPaymentMethodQuery = z.object({
  customerRef: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListPaymentMethodQuery = z.infer<typeof listPaymentMethodQuery>;

/** Initiate hosted-checkout card tokenization (returns a `checkoutLink`). */
export const setupCardBody = z.object({
  customerRef: z.string(),
  amount: z.coerce.number().int().positive(), // kobo — the validation charge
  callbackUrl: z.string().url(),
});
export type SetupCardBody = z.infer<typeof setupCardBody>;

/** Create a direct-debit mandate (customer authorises via NIBSS). */
export const createMandateBody = z.object({
  customerRef: z.string(),
  customerAccountNumber: z.string().min(1),
  bankCode: z.string().min(1),
  customerName: z.string().min(1).max(255),
  maxAmount: z.coerce.number().int().positive(), // kobo — hard per-debit ceiling
  frequency: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly', 'variable'])
    .default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type CreateMandateBody = z.infer<typeof createMandateBody>;

/** Issue a dedicated virtual account (NUBAN) for the transfer rail. */
export const issueVirtualAccountBody = z.object({
  customerRef: z.string(),
  expectedAmount: z.coerce.number().int().positive().optional(), // kobo (hint)
  expiryDate: z.string().optional(),
});
export type IssueVirtualAccountBody = z.infer<typeof issueVirtualAccountBody>;
