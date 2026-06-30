/**
 * Capture-flow response DTOs — what a tenant gets back when initiating a rail
 * capture (the customer-facing instruction / link they must act on).
 */

/** Hosted-checkout tokenize: redirect the customer to `checkoutLink` to save a card. */
export interface CheckoutSetupResponseData {
  /** The pending payment-method reference (promoted to `active` on capture). */
  reference: string;
  checkoutLink: string;
}

/** Direct-debit mandate create: the customer authorises via the NIBSS instruction. */
export interface MandateSetupResponseData {
  reference: string;
  mandateRef: string;
  status: string;
  /** The NIBSS ₦50 validation instruction the customer must complete. */
  consentInstruction: string;
}

/** Virtual account issue: the NUBAN the customer transfers into. */
export interface VirtualAccountResponseData {
  reference: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountRef: string;
}
