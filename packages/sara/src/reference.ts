import { randomDigits } from '@nombaone/utils';

/**
 * Canonical reference format: `nbo{12 digits}{domain}` — lowercase, no
 * separators. The public, merchant-facing identifier (surfaced as the API `id`),
 * distinct from the internal UUID PK. The 12-digit body is uniformly random;
 * uniqueness is enforced by a UNIQUE index on each table's `reference` column —
 * a collision simply violates the index and the (rare) insert is retried by the
 * caller. There is NO app-level retry loop here.
 *
 * Add domains as you ship features. (`EXA` belongs to the deletable example.)
 */
export type ReferenceDomain =
  | 'ORG' // organization (tenant)
  | 'USR' // org user
  | 'KEY' // api key
  | 'EVT' // domain event
  | 'WHK' // webhook endpoint
  | 'WHD' // webhook delivery
  | 'LTX' // ledger transaction
  | 'LAC' // ledger account
  | 'CUS' // customer (subscriber)
  | 'PLN' // plan
  | 'PRC' // price
  | 'PMT' // payment method
  | 'NWE' // nomba (inbound) webhook event
  | 'NMA' // org ↔ nomba account mapping
  | 'SUB' // subscription
  | 'SBI' // subscription item
  | 'INV' // invoice
  | 'ILI' // invoice line item
  | 'SCH' // subscription schedule
  | 'CPN' // coupon
  | 'DSC' // discount
  | 'CRG' // credit grant
  | 'DUN' // dunning attempt
  | 'EXA'; // example (deletable)

export function mintReference(domain: ReferenceDomain): string {
  return `nbo${randomDigits(12)}${domain.toLowerCase()}`;
}
