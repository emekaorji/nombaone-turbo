import type { Environment } from './common';

/**
 * EXAMPLE DTO — part of the deletable example slice. Demonstrates that the public
 * `id` is the resource's stable reference, money is integer kobo, and the wire
 * shape lives in contracts (never re-declared client-side). Delete with the slice.
 */
export type ExampleKind = 'standard' | 'priority';
export type ExampleStatus = 'pending' | 'settled' | 'failed';

export interface ExampleResponseData {
  domain: 'example'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo749201835566exa`
  kind: ExampleKind;
  /** Status is DERIVED from the ledger, never a free-floating field. */
  status: ExampleStatus;
  amountInKobo: number; // kobo
  currency: 'NGN';
  environment: Environment;
  createdAt: string;
}
