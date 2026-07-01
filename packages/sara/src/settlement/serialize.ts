import type { SettlementRow } from '@nombaone/core-db/schema';
import type { SettlementResponseData } from '@nombaone/core-contracts/types';

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
