import type { PriceRow } from '@nombaone/core-db/schema';
import type { PriceResponseData } from './types';

/**
 * Bridge the internal `prices` row to the public DTO. `planId` is emitted as the
 * plan's public **reference** (supplied by the caller — the UUID never leaves the
 * domain); money is integer kobo; `currency` is pinned `NGN` (DB CHECK enforces
 * it). Append-only, so only `createdAt` is exposed.
 */
export const serializePrice = (row: PriceRow, planRef: string): PriceResponseData => ({
  id: row.reference,
  planId: planRef,
  unitAmount: row.unitAmount,
  currency: 'NGN',
  interval: row.interval,
  intervalCount: row.intervalCount,
  usageType: row.usageType,
  billingScheme: row.billingScheme,
  trialPeriodDays: row.trialPeriodDays,
  active: row.active,
  metadata: row.metadata,
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
