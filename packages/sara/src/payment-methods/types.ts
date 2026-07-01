import type {
  PaymentMethodKind,
  PaymentMethodResponseData,
  PaymentMethodStatus,
} from '@nombaone/core-contracts/types';

export type { PaymentMethodKind, PaymentMethodResponseData, PaymentMethodStatus };

export interface SetupCardInput {
  customerRef: string;
  amount: number; // kobo
  callbackUrl: string;
}

export interface CreateMandateInput {
  customerRef: string;
  customerAccountNumber: string;
  bankCode: string;
  customerName: string;
  /** T0 prod: API-required (docs mark them optional but the mandate create rejects). */
  customerAccountName: string;
  customerPhoneNumber: string;
  customerAddress: string;
  narration: string;
  maxAmount: number; // kobo
  frequency: string; // Nomba NIBSS vocabulary (UPPERCASE), e.g. MONTHLY
  /** LocalDateTime (no zone). Defaulted to [tomorrow, +1yr] when omitted. */
  startDate?: string;
  endDate?: string;
}

export interface IssueVirtualAccountInput {
  customerRef: string;
  expectedAmount?: number; // kobo
  expiryDate?: string;
}

export interface ListPaymentMethodsOptions {
  customerRef?: string;
  limit?: number;
  cursor?: string;
}

/** The card data Nomba returns in the `payment_success` webhook (NO full PAN kept). */
export interface TokenizedCardData {
  tokenKey: string;
  cardType?: string;
  cardPan?: string; // masked; we persist only the last 4
  tokenExpiryMonth?: string | number;
  tokenExpiryYear?: string | number;
}
