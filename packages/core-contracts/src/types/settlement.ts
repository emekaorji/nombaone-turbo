export type SettlementStatus = 'pending' | 'settled' | 'reconciled' | 'failed' | 'refunded';

/** A settlement artifact (H5) — integer-kobo split of a collection, no PII. */
export interface SettlementResponseData {
  domain: 'settlement'; // response object-type discriminator
  id: string; // STL reference
  invoiceReference: string | null;
  subAccountRef: string;
  splitReference: string | null;
  merchantTxRef: string;
  grossInKobo: number;
  platformFeeInKobo: number;
  netToTenantInKobo: number;
  status: SettlementStatus;
  createdAt: string;
}

export type RefundStatus = 'pending' | 'ledger_only' | 'succeeded' | 'failed';

/** A refund event — returns only the tenant's share; the platform fee is non-refundable. */
export interface RefundResponseData {
  domain: 'refund'; // response object-type discriminator
  id: string; // REF reference
  settlementReference: string;
  subAccountRef: string;
  amountInKobo: number;
  status: RefundStatus;
  providerReference: string | null;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'ledger_posted' | 'succeeded' | 'failed';

/** A tenant-level withdrawal of settled funds to the tenant's bank. */
export interface PayoutResponseData {
  domain: 'payout'; // response object-type discriminator
  id: string; // PAY reference
  subAccountRef: string;
  amountInKobo: number;
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
  domain: 'escrow'; // response object-type discriminator
  lockedInKobo: number;
  since: string;
  balanceInKobo: number;
  minWithdrawableInKobo: number;
  availableInKobo: number;
}
