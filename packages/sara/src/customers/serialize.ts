import type { CustomerRow } from '@nombaone/core-db/schema';
import type { CustomerResponseData } from './types';

/**
 * The only bridge between the internal `customers` row and the public DTO. The
 * public `id` is the resource's stable `reference` (`nbo…cus`), never the UUID
 * PK; timestamps are emitted as ISO-8601 UTC.
 */
export const serializeCustomer = (row: CustomerRow): CustomerResponseData => ({
  domain: 'customer',
  id: row.reference,
  email: row.email,
  name: row.name,
  phone: row.phone,
  metadata: row.metadata,
  mode: row.mode,
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});
