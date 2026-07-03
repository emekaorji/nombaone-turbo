import type { PaymentMethodRow } from '@nombaone/core-db/schema';
import type { PaymentMethodResponseData } from './types';

/**
 * Bridge the internal `payment_methods` row to the public DTO. **N1 is enforced
 * here too:** `token_key`, `mandate_id`, `account_ref`, and `token_expiry` are
 * INTERNAL — they are never copied onto the wire shape. Only the rail `kind`,
 * capture `status`, and safe card display fields (`brand`/`last4`/`exp`) leak.
 */
export const serializePaymentMethod = (
  row: PaymentMethodRow,
  customerRef: string
): PaymentMethodResponseData => ({
  domain: 'payment_method',
  id: row.reference,
  customerId: customerRef,
  kind: row.kind,
  status: row.status,
  isDefault: row.isDefault,
  brand: row.brand,
  last4: row.last4,
  expMonth: row.expMonth,
  expYear: row.expYear,
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});
