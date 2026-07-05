import type { CreditGrantRow } from '@nombaone/core-db/schema';
import type { CreditGrantResponseData } from './types';

export const serializeCreditGrant = (
  row: CreditGrantRow,
  customerRef: string
): CreditGrantResponseData => ({
  domain: 'credit_grant',
  id: row.reference,
  customerId: customerRef,
  amountInKobo: row.amount,
  remainingInKobo: row.remaining,
  source: row.source,
  sourceReference: row.sourceReference,
  mode: row.mode,
  voidedAt: row.voidedAt ? new Date(row.voidedAt).toISOString() : null,
  createdAt: new Date(row.createdAt).toISOString(),
});
