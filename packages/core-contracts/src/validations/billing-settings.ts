import { z } from 'zod';

/**
 * Partial update of a tenant's billing + dunning policy (`org_billing_settings`).
 * Every field optional (PUT patches only supplied keys). Cross-field refinement:
 * the max dunning window must be ≥ the largest configured interval, else attempts
 * exhaust before the schedule can play out.
 *
 * `dunningIntervalsHours` is FRACTIONAL (`0.25` is fifteen minutes). A retry ladder has
 * to fit inside the billing period it is recovering — the renewal sweep skips `past_due`
 * subscriptions, so a ladder longer than the cadence freezes renewals until dunning
 * resolves. With a sub-day cadence (`interval: 'minute'`) an integer-hour floor made a
 * fitting ladder impossible to express: the first decline on a ten-minute plan would
 * freeze it for an hour at best, 24h by default. It is the ONLY fractional field here —
 * it is backed by `jsonb`, while `dunning_max_window_hours` and `grace_period_hours` are
 * `integer` columns, so accepting a fraction for those would only produce a value
 * Postgres rejects. Neither needs to be sub-hour: exhaustion trips on
 * `dunningMaxAttempts` long before a 1-hour window, and grace already accepts 0.
 *
 * Note that `paydayBiasEnabled` snaps a retry forward onto a calendar payday at 02:00,
 * which swamps any sub-day ladder — turn it OFF on a tenant billing sub-daily.
 */
export const updateBillingSettingsBody = z
  .object({
    partialCollectionEnabled: z.boolean().optional(),
    prorationCreditPolicy: z.enum(['credit_next_cycle', 'none']).optional(),
    dunningMaxAttempts: z.coerce.number().int().min(1).max(10).optional(),
    dunningIntervalsHours: z.array(z.coerce.number().positive()).min(1).optional(),
    dunningMaxWindowHours: z.coerce.number().int().positive().optional(),
    gracePeriodHours: z.coerce.number().int().min(0).optional(),
    paydayDays: z.array(z.coerce.number().int().min(1).max(31)).min(1).optional(),
    paydayPullForwardDays: z.coerce.number().int().min(0).max(28).optional(),
    paydayBiasEnabled: z.boolean().optional(),
    defaultCollectionMethod: z.enum(['charge_automatically', 'send_invoice']).optional(),
    commsEnabled: z.boolean().optional(),
    // Fractional like the dunning ladder (0.02 ≈ one minute); capped to one
    // period length when applied, so short cadences self-shrink it.
    renewalReminderLeadHours: z.coerce.number().positive().optional(),
  })
  .refine(
    (d) =>
      d.dunningMaxWindowHours == null ||
      d.dunningIntervalsHours == null ||
      d.dunningMaxWindowHours >= Math.max(...d.dunningIntervalsHours),
    { message: 'dunningMaxWindowHours must be ≥ the largest dunning interval', path: ['dunningMaxWindowHours'] }
  );
export type UpdateBillingSettingsBody = z.infer<typeof updateBillingSettingsBody>;
