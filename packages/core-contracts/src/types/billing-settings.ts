/** A tenant's billing + dunning policy (`org_billing_settings`), camelCased. */
export interface BillingSettingsResponseData {
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
}
