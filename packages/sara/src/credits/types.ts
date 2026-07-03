import type {
  CreditBalanceResponseData,
  CreditGrantResponseData,
  CreditGrantSource,
} from '@nombaone/core-contracts/types';
import type { Kobo } from '../money';

export type { CreditBalanceResponseData, CreditGrantResponseData, CreditGrantSource };

export interface GrantCreditInput {
  customerRef: string;
  amount: Kobo;
  source: CreditGrantSource;
  sourceReference?: string;
  metadata?: Record<string, unknown>;
}

/** An explicit negative `credit` line consuming one grant. */
export interface CreditLine {
  kind: 'credit';
  description: string;
  amount: Kobo; // signed negative
  sourceReference: string; // the credit_grants reference
}

export interface ListCreditGrantsOptions {
  limit?: number;
  cursor?: string;
}

/** The per-customer ledger account key for the credit balance (liability). */
export const customerCreditAccountKey = (customerRef: string): string =>
  `customer_credit:${customerRef}`;
