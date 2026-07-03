import type { PayoutAvailability } from './escrow';
import type { PayoutRow, RefundRow, SettlementRow } from '@nombaone/core-db/schema';
import type {
  EscrowResponseData,
  PayoutResponseData,
  RefundResponseData,
  SettlementResponseData,
} from '@nombaone/core-contracts/types';

export const serializeSettlement = (
  row: SettlementRow,
  invoiceReference: string | null = null
): SettlementResponseData => ({
  domain: 'settlement',
  id: row.reference,
  invoiceReference,
  subAccountRef: row.subAccountRef,
  splitReference: row.splitReference,
  merchantTxRef: row.merchantTxRef,
  grossInKobo: row.grossKobo,
  platformFeeInKobo: row.platformFeeKobo,
  netToTenantInKobo: row.netToTenantKobo,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

export const serializeRefund = (
  row: RefundRow,
  settlementReference: string
): RefundResponseData => ({
  domain: 'refund',
  id: row.reference,
  settlementReference,
  subAccountRef: row.subAccountRef,
  amountInKobo: row.amountKobo,
  status: row.status,
  providerReference: row.providerReference,
  createdAt: row.createdAt.toISOString(),
});

export const serializePayout = (row: PayoutRow): PayoutResponseData => ({
  domain: 'payout',
  id: row.reference,
  subAccountRef: row.subAccountRef,
  amountInKobo: row.amountKobo,
  bankCode: row.bankCode,
  accountNumber: row.accountNumber,
  resolvedAccountName: row.resolvedAccountName,
  status: row.status,
  providerReference: row.providerReference,
  failureReason: row.failureReason,
  createdAt: row.createdAt.toISOString(),
});

export const serializeEscrow = (availability: PayoutAvailability): EscrowResponseData => ({
  domain: 'escrow',
  lockedInKobo: availability.lockedKobo,
  since: availability.since,
  balanceInKobo: availability.balanceKobo,
  minWithdrawableInKobo: availability.minWithdrawableKobo,
  availableInKobo: availability.availableKobo,
});
