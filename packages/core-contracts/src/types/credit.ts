import type { Environment } from './common';

export type CreditGrantSource = 'downgrade_proration' | 'manual' | 'goodwill' | 'coupon';

export interface CreditGrantResponseData {
  domain: 'credit_grant'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo…crg`
  customerId: string;
  amountInKobo: number; // kobo granted
  remainingInKobo: number; // kobo unconsumed
  source: CreditGrantSource;
  sourceReference: string | null;
  environment: Environment;
  voidedAt: string | null;
  createdAt: string;
}

/** The per-customer credit balance (the ledger truth) + its grant audit list. */
export interface CreditBalanceResponseData {
  domain: 'credit_balance'; // response object-type discriminator
  customerId: string;
  balanceInKobo: number; // kobo (O(1) from the customer_credit ledger account)
  grants: CreditGrantResponseData[];
}
