import type { Environment } from './common';

/**
 * PAYMENT METHOD DTO — a customer's instance on one rail. **N1 is structural:**
 * the wire shape carries NO `token_key`, `mandate_id`, `account_ref`, or any PAN —
 * only the rail `kind`, capture `status`, and safe card display fields.
 */
export type PaymentMethodKind = 'card' | 'mandate' | 'virtual_account';
export type PaymentMethodStatus =
  | 'setup_pending'
  | 'consent_pending'
  | 'active'
  | 'removed'
  | 'expired';

export interface PaymentMethodResponseData {
  domain: 'payment_method'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo749201835566pmt`
  customerId: string; // the customer's public reference (`nbo…cus`)
  kind: PaymentMethodKind;
  status: PaymentMethodStatus;
  isDefault: boolean;
  /** Card display only (null for mandate / virtual_account). Never a PAN. */
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}
