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
  bankCode: z.string().min(1), // CBN 3-digit code (058 GTB · 044 Access · 033 UBA…)
  customerName: z.string().min(1).max(255),
  // T0 prod: the docs mark these "optional" but the mandate create REJECTS without them.
  customerAccountName: z.string().min(1).max(255),
  customerPhoneNumber: z.string().min(1),
  customerAddress: z.string().min(1).max(500),
  narration: z.string().min(1).max(255),
  maxAmount: z.coerce.number().int().positive(), // kobo — hard per-debit ceiling
  // Nomba NIBSS frequency vocabulary (UPPERCASE — the lowercase set was rejected).
  frequency: z
    .enum([
      'VARIABLE',
      'WEEKLY',
      'EVERY_TWO_WEEKS',
      'MONTHLY',
      'EVERY_TWO_MONTHS',
      'EVERY_THREE_MONTHS',
      'EVERY_FOUR_MONTHS',
      'EVERY_SIX_MONTHS',
      'EVERY_TWELVE_MONTHS',
    ])
    .default('MONTHLY'),
  // LocalDateTime (no zone), present/future; sara normalizes + defaults [tomorrow,+1yr].
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
