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

export type RefundStatus = 'pending' | 'ledger_only' | 'succeeded' | 'failed';

/** A refund event — returns only the tenant's share; the platform fee is non-refundable. */
export interface RefundResponseData {
  id: string; // REF reference
  settlementReference: string;
  subAccountRef: string;
  amountKobo: number;
  status: RefundStatus;
  providerReference: string | null;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'ledger_posted' | 'succeeded' | 'failed';

/** A tenant-level withdrawal of settled funds to the tenant's bank. */
export interface PayoutResponseData {
  id: string; // PAY reference
  subAccountRef: string;
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  resolvedAccountName: string | null;
  status: PayoutStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
}

/** The rolling escrow lock + available-to-withdraw view for a tenant. */
export interface EscrowResponseData {
  lockedKobo: number;
  since: string;
  balanceKobo: number;
  minWithdrawableKobo: number;
  availableKobo: number;
}
