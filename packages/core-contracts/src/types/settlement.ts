export type SettlementStatus = 'pending' | 'settled' | 'reconciled' | 'failed' | 'refunded';

/** A settlement artifact (H5) — integer-kobo split of a collection, no PII. */
export interface SettlementResponseData {
  id: string; // STL reference
  invoiceReference: string | null;
  subAccountRef: string;
  splitReference: string | null;
  merchantTxRef: string;
  grossKobo: number;
  platformFeeKobo: number;
  netToTenantKobo: number;
  status: SettlementStatus;
  createdAt: string;
}
