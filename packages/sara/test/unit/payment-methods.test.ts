import { describe, expect, it } from 'vitest';

import { serializePaymentMethod } from '@nombaone/sara/payment-methods';

import type { PaymentMethodRow } from '@nombaone/core-db/schema';

const row = {
  id: 'pm-uuid',
  reference: 'nbo000000000001pmt',
  organizationId: 'org-uuid',
  mode: 'sandbox',
  customerId: 'cust-uuid',
  kind: 'card',
  status: 'active',
  tokenKey: 'tok_SUPER_SECRET',
  mandateId: 'mandate_SECRET',
  accountRef: 'acct_SECRET',
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2030,
  tokenExpiry: '12/2030',
  isDefault: true,
  metadata: {},
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
} as unknown as PaymentMethodRow;

describe('payment-methods/serialize (N1)', () => {
  it('exposes safe fields and NEVER leaks token / mandate id / account ref / PAN', () => {
    const dto = serializePaymentMethod(row, 'nbo000000000001cus');

    expect(dto).toMatchObject({
      id: 'nbo000000000001pmt',
      customerId: 'nbo000000000001cus',
      kind: 'card',
      status: 'active',
      isDefault: true,
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    });

    const json = JSON.stringify(dto);
    expect(json).not.toContain('SECRET');
    expect(json).not.toContain('tokenKey');
    expect(Object.keys(dto)).not.toContain('tokenKey');
    expect(Object.keys(dto)).not.toContain('mandateId');
    expect(Object.keys(dto)).not.toContain('accountRef');
    expect(Object.keys(dto)).not.toContain('tokenExpiry');
  });
});
