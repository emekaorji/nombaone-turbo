import type { CustomerResponseData } from '@nombaone/core-contracts/types';

/**
 * The customers slice's internal types. The WIRE shape (`CustomerResponseData`)
 * lives in `@nombaone/core-contracts` and is never re-declared here — the domain
 * imports it so the contract has one home. This file declares only the INPUT
 * shapes the domain functions accept; everything outbound flows through the
 * serializer.
 */
export type { CustomerResponseData };

/** Input to `createCustomer`. */
export interface CreateCustomerInput {
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

/** Partial input to `updateCustomer` (email is immutable — it is the natural key). */
export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  metadata?: Record<string, unknown>;
}

/** Filter / paging options for `listCustomers`. */
export interface ListCustomersOptions {
  email?: string;
  limit?: number;
  cursor?: string;
}
