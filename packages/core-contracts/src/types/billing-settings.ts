/** A tenant's billing + dunning policy (`org_billing_settings`), camelCased. */
export interface BillingSettingsResponseData {
  domain: 'billing_settings'; // response object-type discriminator
  partialCollectionEnabled: boolean;
  prorationCreditPolicy: 'credit_next_cycle' | 'none';
  dunningMaxAttempts: number;
  dunningIntervalsHours: number[];
  dunningMaxWindowHours: number;
  gracePeriodHours: number;
  paydayDays: number[];
  paydayPullForwardDays: number;
  paydayBiasEnabled: boolean;
  defaultCollectionMethod: 'charge_automatically' | 'send_invoice';
  commsEnabled: boolean;
  /** Renewal-reminder lead, fractional hours; capped at one period length at use-time. */
  renewalReminderLeadHours: number;
}
