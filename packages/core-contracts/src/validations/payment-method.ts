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
  amountInKobo: z.coerce.number().int().positive(), // kobo — the validation charge
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
  maxAmountInKobo: z.coerce.number().int().positive(), // kobo — hard per-debit ceiling
  // Billing cadence (snake_case). Mapped to NIBSS's UPPERCASE at the Nomba boundary.
  frequency: z
    .enum([
      'variable',
      'weekly',
      'every_two_weeks',
      'monthly',
      'every_two_months',
      'every_three_months',
      'every_four_months',
      'every_six_months',
      'every_twelve_months',
    ])
    .default('monthly'),
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
