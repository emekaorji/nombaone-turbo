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
  id: row.reference,
  invoiceReference,
  subAccountRef: row.subAccountRef,
  splitReference: row.splitReference,
  merchantTxRef: row.merchantTxRef,
  grossKobo: row.grossKobo,
  platformFeeKobo: row.platformFeeKobo,
  netToTenantKobo: row.netToTenantKobo,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

export const serializeRefund = (
  row: RefundRow,
  settlementReference: string
): RefundResponseData => ({
  id: row.reference,
  settlementReference,
  subAccountRef: row.subAccountRef,
  amountKobo: row.amountKobo,
  status: row.status,
  providerReference: row.providerReference,
  createdAt: row.createdAt.toISOString(),
});

export const serializePayout = (row: PayoutRow): PayoutResponseData => ({
  id: row.reference,
  subAccountRef: row.subAccountRef,
  amountKobo: row.amountKobo,
  bankCode: row.bankCode,
  accountNumber: row.accountNumber,
  resolvedAccountName: row.resolvedAccountName,
  status: row.status,
  providerReference: row.providerReference,
  failureReason: row.failureReason,
  createdAt: row.createdAt.toISOString(),
});

export const serializeEscrow = (availability: PayoutAvailability): EscrowResponseData => ({
  lockedKobo: availability.lockedKobo,
  since: availability.since,
  balanceKobo: availability.balanceKobo,
  minWithdrawableKobo: availability.minWithdrawableKobo,
  availableKobo: availability.availableKobo,
});
