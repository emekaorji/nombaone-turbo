import type { Environment } from './common';

export type CreditGrantSource = 'downgrade_proration' | 'manual' | 'goodwill' | 'coupon';

export interface CreditGrantResponseData {
  id: string; // public reference, e.g. `nbo…crg`
  customerId: string;
  amount: number; // kobo granted
  remaining: number; // kobo unconsumed
  source: CreditGrantSource;
  sourceReference: string | null;
  environment: Environment;
  voidedAt: string | null;
  createdAt: string;
}

/** The per-customer credit balance (the ledger truth) + its grant audit list. */
export interface CreditBalanceResponseData {
  customerId: string;
  balance: number; // kobo (O(1) from the customer_credit ledger account)
  grants: CreditGrantResponseData[];
}
