export interface DunningFunnelData {
  scheduled: number;
  attempting: number;
  cardUpdateRequired: number;
  rescheduled: number;
  succeeded: number;
  exhausted: number;
}

/** Derived billing metrics (M ★) — computed from the ledger/events, never a counter. */
export interface BillingMetricsData {
  domain: 'billing_metrics'; // response object-type discriminator
  mrrInKobo: number;
  activeCount: number;
  voluntaryChurn: number;
  involuntaryChurn: number;
  failedChargeRate: number; // 0..1
  dunningRecoveryRate: number; // 0..1
  dunningFunnel: DunningFunnelData;
  windowFrom: string; // ISO-8601 UTC
  windowTo: string;
}
