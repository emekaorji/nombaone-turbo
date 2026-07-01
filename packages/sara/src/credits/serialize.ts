import type { CreditGrantRow } from '@nombaone/core-db/schema';
import type { CreditGrantResponseData } from './types';

export const serializeCreditGrant = (
  row: CreditGrantRow,
  customerRef: string
): CreditGrantResponseData => ({
  id: row.reference,
  customerId: customerRef,
  amount: row.amount,
  remaining: row.remaining,
  source: row.source,
  sourceReference: row.sourceReference,
  environment: row.environment,
  voidedAt: row.voidedAt ? new Date(row.voidedAt).toISOString() : null,
  createdAt: new Date(row.createdAt).toISOString(),
});
