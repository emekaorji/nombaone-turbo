import { z } from 'zod';

/**
 * Partial update of a tenant's billing + dunning policy (`org_billing_settings`).
 * Every field optional (PUT patches only supplied keys). Cross-field refinement:
 * the max dunning window must be ≥ the largest configured interval, else attempts
 * exhaust before the schedule can play out.
 */
export const updateBillingSettingsBody = z
  .object({
    partialCollectionEnabled: z.boolean().optional(),
    prorationCreditPolicy: z.enum(['credit_next_cycle', 'none']).optional(),
    dunningMaxAttempts: z.coerce.number().int().min(1).max(10).optional(),
    dunningIntervalsHours: z.array(z.coerce.number().int().positive()).min(1).optional(),
    dunningMaxWindowHours: z.coerce.number().int().positive().optional(),
    gracePeriodHours: z.coerce.number().int().min(0).optional(),
    paydayDays: z.array(z.coerce.number().int().min(1).max(31)).min(1).optional(),
    paydayPullForwardDays: z.coerce.number().int().min(0).max(28).optional(),
    paydayBiasEnabled: z.boolean().optional(),
    defaultCollectionMethod: z.enum(['charge_automatically', 'send_invoice']).optional(),
    commsEnabled: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.dunningMaxWindowHours == null ||
      d.dunningIntervalsHours == null ||
      d.dunningMaxWindowHours >= Math.max(...d.dunningIntervalsHours),
    { message: 'dunningMaxWindowHours must be ≥ the largest dunning interval', path: ['dunningMaxWindowHours'] }
  );
export type UpdateBillingSettingsBody = z.infer<typeof updateBillingSettingsBody>;
