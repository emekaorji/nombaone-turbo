import type { Environment } from './common';

/**
 * CUSTOMER DTO — a tenant's end-payer (subscriber). The public `id` is the
 * resource's stable `reference` (`nbo…cus`), never the internal UUID. `metadata`
 * is an opaque tenant-owned bag. Timestamps are ISO-8601 UTC.
 */
export interface CustomerResponseData {
  id: string; // public reference, e.g. `nbo749201835566cus`
  email: string;
  name: string;
  phone: string | null;
  metadata: Record<string, unknown>;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}
